import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { recordActivity } from "@/lib/activity";
import { parseAppDate } from "@/lib/utils";
import { canReadProject } from "@/lib/project-access";
import { z } from "zod";

const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
  due_date: z.string().nullable().optional(),
  space_id: z.string().uuid().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
  onboarding_enabled: z.boolean().optional(),
  closing_date: z.string().nullable().optional(),
  onboarding_start_date: z.string().nullable().optional(),
  responsible_salesperson_id: z.string().uuid().nullable().optional(),
  initial_notes: z.string().nullable().optional(),
});

function parsePatchDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return parseAppDate(value);
}

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { tasks: true, docs: true } },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canReadProject(auth, project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(project);
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isWorkspaceAdminFor(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = UpdateProjectSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid project", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const {
    name,
    description,
    status,
    due_date,
    space_id,
    folder_id,
    company_id,
    onboarding_enabled,
    closing_date,
    onboarding_start_date,
    responsible_salesperson_id,
    initial_notes,
  } = body;
  const parsedDueDate = parsePatchDate(due_date);
  const parsedClosingDate = parsePatchDate(closing_date);
  const parsedOnboardingStartDate = parsePatchDate(onboarding_start_date);
  if (parsedDueDate === "invalid") {
    return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
  }
  if (parsedClosingDate === "invalid" || parsedOnboardingStartDate === "invalid") {
    return NextResponse.json({ error: "Invalid onboarding date" }, { status: 400 });
  }

  if (space_id) {
    const space = await prisma.space.findUnique({ where: { id: space_id } });
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
    if (space.workspace_id !== project.workspace_id) {
      return NextResponse.json({ error: "Cannot move across workspaces" }, { status: 400 });
    }
  }
  if (folder_id) {
    const folder = await prisma.folder.findUnique({ where: { id: folder_id } });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 400 });
    if (folder.workspace_id !== project.workspace_id) {
      return NextResponse.json({ error: "Cannot move across workspaces" }, { status: 400 });
    }
    const targetSpaceId = space_id ?? project.space_id;
    if (targetSpaceId && folder.space_id !== targetSpaceId) {
      return NextResponse.json({ error: "Folder does not belong to selected space" }, { status: 400 });
    }
  }
  if (company_id) {
    const company = await prisma.company.findFirst({
      where: { id: company_id, workspace_id: project.workspace_id },
      select: { id: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(parsedDueDate !== undefined && { due_date: parsedDueDate }),
      ...(onboarding_enabled !== undefined && { onboarding_enabled }),
      ...(parsedClosingDate !== undefined && { closing_date: parsedClosingDate }),
      ...(parsedOnboardingStartDate !== undefined && { onboarding_start_date: parsedOnboardingStartDate }),
      ...(responsible_salesperson_id !== undefined && { responsible_salesperson_id: responsible_salesperson_id || null }),
      ...(initial_notes !== undefined && { initial_notes }),
      ...(space_id !== undefined && { space_id: space_id || null }),
      ...(folder_id !== undefined && { folder_id: folder_id || null }),
      ...(company_id !== undefined && { company_id: company_id || null }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      space: { select: { id: true, name: true, icon: true } },
      folder: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });

  await recordActivity({
    workspace_id: project.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "project_updated",
    entity_type: "project",
    entity_id: updated.id,
    project_id: updated.id,
    metadata: {
      name: updated.name,
      status: updated.status,
    },
  });

  return NextResponse.json(updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isWorkspaceAdminFor(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const [tasks, docs] = await Promise.all([
      tx.task.findMany({
        where: { project_id: project.id },
        select: { id: true },
      }),
      tx.doc.findMany({
        where: { project_id: project.id },
        select: { id: true },
      }),
    ]);
    const taskIds = tasks.map((task) => task.id);
    const docIds = docs.map((doc) => doc.id);
    const approvalEntityIds = [project.id, ...taskIds, ...docIds];

    const approvalRequests = await tx.approvalRequest.findMany({
      where: {
        workspace_id: project.workspace_id,
        entity_id: { in: approvalEntityIds },
        entity_type: { in: ["project", "task", "doc", "report", "campaign", "deliverable"] },
      },
      select: { id: true },
    });
    const approvalIds = approvalRequests.map((approval) => approval.id);

    const deleted = {
      approval_events: approvalIds.length
        ? (await tx.approvalEvent.deleteMany({
            where: { approval_id: { in: approvalIds } },
          })).count
        : 0,
      approval_requests: approvalIds.length
        ? (await tx.approvalRequest.deleteMany({
            where: { id: { in: approvalIds } },
          })).count
        : 0,
      notifications: taskIds.length
        ? (await tx.notification.deleteMany({
            where: { task_id: { in: taskIds } },
          })).count
        : 0,
      time_entries: (await tx.timeEntry.deleteMany({
        where: {
          OR: [
            { project_id: project.id },
            ...(taskIds.length ? [{ task_id: { in: taskIds } }] : []),
          ],
        },
      })).count,
      calendar_events: (await tx.calendarEvent.deleteMany({
        where: {
          OR: [
            { project_id: project.id },
            ...(taskIds.length ? [{ task_id: { in: taskIds } }] : []),
          ],
        },
      })).count,
      recurring_rules: (await tx.recurringTaskRule.deleteMany({
        where: {
          OR: [
            { project_id: project.id },
            ...(taskIds.length ? [{ task_id: { in: taskIds } }] : []),
          ],
        },
      })).count,
      onboarding_task_links: taskIds.length
        ? (await tx.onboardingChecklistItem.updateMany({
            where: { task_id: { in: taskIds } },
            data: { task_id: null },
          })).count
        : 0,
      client_onboardings: (await tx.clientOnboarding.updateMany({
        where: { project_id: project.id },
        data: { project_id: null },
      })).count,
      client_contracts: (await tx.clientContract.updateMany({
        where: { project_id: project.id },
        data: { project_id: null },
      })).count,
      task_dependencies: taskIds.length
        ? (await tx.taskDependency.deleteMany({
            where: {
              OR: [
                { task_id: { in: taskIds } },
                { depends_on_id: { in: taskIds } },
              ],
            },
          })).count
        : 0,
      comments: taskIds.length
        ? (await tx.comment.deleteMany({
            where: { task_id: { in: taskIds } },
          })).count
        : 0,
      custom_field_values: taskIds.length
        ? (await tx.customFieldValue.deleteMany({
            where: { task_id: { in: taskIds } },
          })).count
        : 0,
      custom_fields: (await tx.customFieldDefinition.deleteMany({
        where: { project_id: project.id },
      })).count,
      workflow_statuses: (await tx.workflowStatus.deleteMany({
        where: { project_id: project.id },
      })).count,
      project_members: (await tx.projectMember.deleteMany({
        where: { project_id: project.id },
      })).count,
      docs: (await tx.doc.deleteMany({
        where: { project_id: project.id },
      })).count,
      activity_events: (await tx.activityEvent.deleteMany({
        where: {
          workspace_id: project.workspace_id,
          OR: [
            { project_id: project.id },
            { entity_type: "project", entity_id: project.id },
            ...(taskIds.length ? [{ task_id: { in: taskIds } }] : []),
            ...(taskIds.length ? [{ entity_type: "task", entity_id: { in: taskIds } }] : []),
            ...(docIds.length ? [{ entity_type: "doc", entity_id: { in: docIds } }] : []),
          ],
        },
      })).count,
      tasks: (await tx.task.deleteMany({
        where: { project_id: project.id },
      })).count,
      projects: (await tx.project.deleteMany({
        where: { id: project.id },
      })).count,
    };

    if (deleted.projects !== 1) {
      throw new Error("Project delete did not remove the project row");
    }

    await tx.activityEvent.create({
      data: {
        workspace_id: project.workspace_id,
        actor_id: auth.prismaUser.id,
        type: "project_deleted",
        entity_type: "project",
        entity_id: project.id,
        metadata: { name: project.name, deleted },
      },
    });

    return deleted;
  });

  return NextResponse.json({ success: true, deleted: result });
}
export const GET = withErrorReporting("api:projects/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:projects/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:projects/id:DELETE", DELETE_handler);
