import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { Prisma, type TaskStatus, type TaskPriority } from "@prisma/client";
import { buildPage, parsePagination } from "@/lib/pagination";
import { collectPeopleIds, validateCustomFieldBatch } from "@/lib/custom-field-validator";
import { logError } from "@/lib/log-error";
import { notifyTaskAssignee } from "@/lib/task-assignment-notifications";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { recordActivity } from "@/lib/activity";
import { parseAppDate } from "@/lib/utils";
import { parseTaskImageUrl } from "@/lib/task-images";
import { deleteTasksByIds } from "@/lib/task-delete";
import {
  canAssignUserToProject,
  canContributeToProject,
  canReadProject,
  readableProjectWhere,
} from "@/lib/project-access";
import { attachTaskOnboardingLink, loadTaskOnboardingLinkMap } from "@/lib/task-onboarding-links";
import { repairOnboardingTaskRouting } from "@/lib/onboarding";
import { SPACE_TASK_STATUS_FIELD_NAME, defaultSpaceTaskStatusName } from "@/lib/space-task-status";
import { isSpaceWorkflowSchemaUnavailable } from "@/lib/space-workflow-schema";

function parseDueDate(input: unknown): Date | null | "invalid" {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "string") return "invalid";
  return parseAppDate(input);
}

async function getHandler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const mine = searchParams.get("mine") === "true";
  const parentId = searchParams.get("parent_id");

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspace_id: true, owner_id: true },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await canReadProject(auth, project))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isWorkspaceAdminFor(auth, project.workspace_id)) {
      await prisma
        .$transaction((tx) =>
          repairOnboardingTaskRouting(tx, {
            workspaceId: project.workspace_id,
            projectId: project.id,
            ownerId: auth.prismaUser.id,
          }),
        )
        .catch((err) =>
          logError("api:tasks:GET:repair-onboarding-routing", err, {
            project_id: project.id,
            workspace_id: project.workspace_id,
          }),
        );
    }
  }

  const where: Prisma.TaskWhereInput = {};
  if (projectId) where.project_id = projectId;
  if (mine) where.assignee_id = auth.prismaUser.id;
  if (parentId) where.parent_id = parentId;

  // If no projectId filter, scope to the active workspace so the UI stays
  // consistent with the workspace switcher.
  if (!projectId) {
    if (!auth.currentWorkspaceId) {
      return NextResponse.json({ items: [], nextCursor: null });
    }
    where.project = readableProjectWhere(auth, auth.currentWorkspaceId);
  }

  const { limit, cursor } = parsePagination(req, { defaultLimit: 200, maxLimit: 500 });

  const rows = await prisma.task.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ position: "asc" }, { created_at: "desc" }, { id: "asc" }],
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      custom_field_values: {
        select: { definition_id: true, value: true },
      },
      marketing_b2b_onboarding_form: {
        select: { id: true, status: true, completed_at: true },
      },
      marketing_b2c_onboarding_form: {
        select: { id: true, status: true, completed_at: true },
      },
      _count: { select: { comments: true, subtasks: true } },
    },
  });

  const onboardingLinkByTaskId = await loadTaskOnboardingLinkMap(
    rows.map((task) => task.id),
  );
  const items = rows.map((task) => attachTaskOnboardingLink(task, onboardingLinkByTaskId));

  return NextResponse.json(buildPage(items, limit));
}

async function postHandler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const body = await req.json() as {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    project_id?: string;
    company_id?: string | null;
    assignee_id?: string;
    due_date?: string;
    cover_image_url?: string | null;
    parent_id?: string;
    custom_fields?: Array<{ definition_id: string; value: unknown }>;
  };

  const { title, description, status, priority, project_id, assignee_id, parent_id, custom_fields } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!project_id) return NextResponse.json({ error: "project_id is required" }, { status: 400 });

  if (custom_fields !== undefined && !Array.isArray(custom_fields)) {
    return NextResponse.json(
      { error: "custom_fields must be an array of { definition_id, value }" },
      { status: 400 }
    );
  }

  if (
    body.company_id !== undefined &&
    body.company_id !== null &&
    typeof body.company_id !== "string"
  ) {
    return NextResponse.json({ error: "company_id must be a string or null" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: project_id },
    select: { id: true, workspace_id: true, owner_id: true, company_id: true, space_id: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!(await canContributeToProject(auth, project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedCompanyId =
    typeof body.company_id === "string" ? body.company_id.trim() || null : body.company_id;
  let companyId = project.company_id ?? null;
  if (requestedCompanyId) {
    if (project.company_id && project.company_id !== requestedCompanyId) {
      return NextResponse.json(
        { error: "Tasks in a client project must stay linked to that client" },
        { status: 400 },
      );
    }
    const company = await prisma.company.findFirst({
      where: { id: requestedCompanyId, workspace_id: project.workspace_id },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 400 });
    }
    companyId = company.id;
  }

  if (assignee_id) {
    if (!(await canAssignUserToProject(project, assignee_id))) {
      return NextResponse.json(
        { error: "Assignee is not an active member with access to this project" },
        { status: 400 },
      );
    }
  }

  const dueDate = parseDueDate(body.due_date);
  if (dueDate === "invalid") {
    return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
  }
  const coverImageUrl = parseTaskImageUrl(body.cover_image_url);
  if (coverImageUrl === "invalid") {
    return NextResponse.json(
      { error: "Invalid cover_image_url. Upload an image or use an HTTPS image URL." },
      { status: 400 },
    );
  }

  if (parent_id) {
    const parent = await prisma.task.findUnique({
      where: { id: parent_id },
      select: { project_id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }
    if (parent.project_id !== project_id) {
      return NextResponse.json(
        { error: "Subtask must be in the same project as its parent" },
        { status: 400 }
      );
    }
  }

  const lastTask = await prisma.task.findFirst({
    where: { project_id, status: status ?? "todo" },
    orderBy: { position: "desc" },
  });
  const position = (lastTask?.position ?? -1) + 1;

  const cfEntries = (custom_fields ?? []).filter(
    (e) => e && e.definition_id && e.value !== undefined && e.value !== "" && e.value !== null
  );

  if (project.space_id) {
    try {
      const [spaceStatuses, spaceField] = await Promise.all([
        prisma.workflowStatus.findMany({
          where: {
            workspace_id: project.workspace_id,
            space_id: project.space_id,
            project_id: null,
            category: "task",
            active: true,
          },
          orderBy: [{ stage_order: "asc" }, { id: "asc" }],
        }),
        prisma.customFieldDefinition.findFirst({
          where: {
            project_id,
            name: SPACE_TASK_STATUS_FIELD_NAME,
            type: "dropdown",
          },
          select: { id: true },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        }),
      ]);
      if (
        spaceField &&
        spaceStatuses.length > 0 &&
        !cfEntries.some((entry) => entry.definition_id === spaceField.id)
      ) {
        cfEntries.push({
          definition_id: spaceField.id,
          value: defaultSpaceTaskStatusName(spaceStatuses, status ?? "todo"),
        });
      }
    } catch (error) {
      if (!isSpaceWorkflowSchemaUnavailable(error)) throw error;
    }
  }

  const cfNormalized = new Map<string, unknown>();
  if (cfEntries.length > 0) {
    const defs = await prisma.customFieldDefinition.findMany({
      where: { id: { in: cfEntries.map((e) => e.definition_id) } },
      select: { id: true, name: true, type: true, options: true, project_id: true },
    });
    if (defs.length !== cfEntries.length || defs.some((d) => d.project_id !== project_id)) {
      return NextResponse.json(
        { error: "Invalid custom field for this project" },
        { status: 400 }
      );
    }
    const result = validateCustomFieldBatch(defs, cfEntries);
    if (!result.ok) {
      return NextResponse.json(
        { error: `Invalid value for "${result.field}": ${result.error}` },
        { status: 400 }
      );
    }
    result.normalized.forEach((v, k) => cfNormalized.set(k, v));

    // People-type fields: every referenced user must be a member of the
    // project's workspace. We do this in the API layer (not the shared
    // validator) so the validator stays pure / usable on the client.
    const peopleIds = collectPeopleIds(defs, result.normalized);
    if (peopleIds.length > 0) {
      const members = await prisma.workspaceMember.findMany({
        where: { workspace_id: project.workspace_id, user_id: { in: peopleIds } },
        select: { user_id: true },
      });
      const memberSet = new Set(members.map((m) => m.user_id));
      for (const def of defs) {
        if (def.type !== "people") continue;
        const v = cfNormalized.get(def.id);
        if (!Array.isArray(v)) continue;
        const bad = (v as string[]).find((id) => !memberSet.has(id));
        if (bad) {
          return NextResponse.json(
            {
              error: `Invalid value for "${def.name}": user ${bad} is not a member of this workspace`,
            },
            { status: 400 },
          );
        }
      }
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        status: status ?? "todo",
        priority: priority ?? "medium",
        project_id,
        company_id: companyId,
        cover_image_url: coverImageUrl,
        assignee_id: assignee_id || null,
        due_date: dueDate,
        parent_id: parent_id || null,
        position,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        marketing_b2b_onboarding_form: {
          select: { id: true, status: true, completed_at: true },
        },
        marketing_b2c_onboarding_form: {
          select: { id: true, status: true, completed_at: true },
        },
      },
    });

    if (cfEntries.length > 0) {
      await tx.customFieldValue.createMany({
        data: cfEntries
          .filter((e) => {
            const v = cfNormalized.get(e.definition_id);
            return v !== null && v !== undefined;
          })
          .map((e) => ({
            task_id: created.id,
            definition_id: e.definition_id,
            value: cfNormalized.get(e.definition_id) as Prisma.InputJsonValue,
          })),
      });
    }

    return created;
  });

  if (assignee_id) {
    await notifyTaskAssignee({
      taskId: task.id,
      userId: assignee_id,
      workspaceId: project.workspace_id,
    });
  }

  await recordActivity({
    workspace_id: project.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "task_created",
    entity_type: "task",
    entity_id: task.id,
    project_id: task.project_id,
    task_id: task.id,
    company_id: project.company_id,
    metadata: {
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignee_id: task.assignee_id,
      company_id: task.company_id,
    },
  });

  return NextResponse.json(task, { status: 201 });
}

async function deleteHandler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  if (!Array.isArray(body?.ids)) {
    return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  }

  const ids = Array.from(
    new Set(
      body.ids
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one task" }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: "Delete up to 200 tasks at once" }, { status: 400 });
  }

  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      project_id: true,
      company_id: true,
      project: { select: { id: true, workspace_id: true, owner_id: true } },
    },
  });
  if (tasks.length !== ids.length) {
    return NextResponse.json({ error: "One or more tasks were not found" }, { status: 404 });
  }

  const projects = new Map(tasks.map((task) => [task.project.id, task.project]));
  for (const project of projects.values()) {
    if (!(await canContributeToProject(auth, project))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  for (const task of tasks) {
    await recordActivity({
      workspace_id: task.project.workspace_id,
      actor_id: auth.prismaUser.id,
      type: "task_deleted",
      entity_type: "task",
      entity_id: task.id,
      project_id: task.project_id,
      task_id: task.id,
      company_id: task.company_id,
      metadata: { title: task.title, bulk_deleted: true },
    });
  }

  const deleted = await prisma.$transaction((tx) => deleteTasksByIds(tx, ids));
  return NextResponse.json({ success: true, deleted });
}

export const GET = withErrorReporting("api:tasks:GET", getHandler);
export const POST = withErrorReporting("api:tasks:POST", postHandler);
export const DELETE = withErrorReporting("api:tasks:DELETE", deleteHandler);
