import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { broadcastNotification } from "@/lib/supabase-server";
import { Prisma, type TaskStatus, type TaskPriority } from "@prisma/client";
import { buildPage, parsePagination } from "@/lib/pagination";
import { collectPeopleIds, validateCustomFieldBatch } from "@/lib/custom-field-validator";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { recordActivity } from "@/lib/activity";
import { parseAppDate } from "@/lib/utils";
import { parseTaskImageUrl } from "@/lib/task-images";

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
      select: { workspace_id: true },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canAccessWorkspace(auth, project.workspace_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    where.project = { workspace_id: auth.currentWorkspaceId };
  }

  const { limit, cursor } = parsePagination(req, { defaultLimit: 500, maxLimit: 1000 });

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
      _count: { select: { comments: true, subtasks: true } },
    },
  });

  return NextResponse.json(buildPage(rows, limit));
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

  const project = await prisma.project.findUnique({
    where: { id: project_id },
    select: { id: true, workspace_id: true, company_id: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (assignee_id) {
    // Assignee must be a member of the project's workspace.
    const ok = await prisma.workspaceMember.findFirst({
      where: { workspace_id: project.workspace_id, user_id: assignee_id, status: "active" },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Assignee is not an active member of this workspace" },
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
      { error: "Invalid cover_image_url. Upload images first or use a valid image URL." },
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

  const userId = auth.prismaUser.id;

  const lastTask = await prisma.task.findFirst({
    where: { project_id, status: status ?? "todo" },
    orderBy: { position: "desc" },
  });
  const position = (lastTask?.position ?? -1) + 1;

  const cfEntries = (custom_fields ?? []).filter(
    (e) => e && e.definition_id && e.value !== undefined && e.value !== "" && e.value !== null
  );

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
        company_id: project.company_id,
        cover_image_url: coverImageUrl,
        assignee_id: assignee_id || null,
        due_date: dueDate,
        parent_id: parent_id || null,
        position,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
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

  if (assignee_id && assignee_id !== userId) {
    await prisma.notification
      .create({ data: { type: "assigned", user_id: assignee_id, task_id: task.id } })
      .catch((err) => logError("api:tasks:POST:notify", err, { task_id: task.id }));
    await broadcastNotification(assignee_id).catch((err) =>
      logError("api:tasks:POST:broadcast", err, { task_id: task.id, user_id: assignee_id }),
    );
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
    },
  });

  return NextResponse.json(task, { status: 201 });
}

export const GET = withErrorReporting("api:tasks:GET", getHandler);
export const POST = withErrorReporting("api:tasks:POST", postHandler);

