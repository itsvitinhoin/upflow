import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import {
  requireCurrentWorkspace,
  validateContributableProjectScope,
  validateContributableTaskScope,
} from "@/lib/api/scope";
import { recordActivity } from "@/lib/activity";
import { isWorkspaceAdminFor, type AuthUser } from "@/lib/auth-helpers";
import { canContributeToProject } from "@/lib/project-access";
import { withErrorReporting } from "@/lib/with-error-reporting";

const UpdateRecurringRuleSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  rrule: z.string().trim().min(6).max(500).refine((value) => value.includes("FREQ="), {
    message: "Use an RRULE string that includes FREQ",
  }).optional(),
  project_id: z.string().uuid().nullable().optional(),
  task_id: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

async function canManageRecurringRule(
  auth: AuthUser,
  rule: {
    workspace_id: string;
    created_by: string;
    project: { id: string; workspace_id: string; owner_id: string | null } | null;
  },
) {
  if (isWorkspaceAdminFor(auth, rule.workspace_id)) return true;
  if (rule.created_by === auth.prismaUser.id) return true;
  if (rule.project && (await canContributeToProject(auth, rule.project))) return true;
  return false;
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const existing = await prisma.recurringTaskRule.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId },
    include: {
      project: { select: { id: true, workspace_id: true, owner_id: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Recurring task rule not found" }, { status: 404 });
  }
  if (!(await canManageRecurringRule(auth, existing))) {
    return NextResponse.json({ error: "Recurring task rule access required" }, { status: 403 });
  }

  const parsed = UpdateRecurringRuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid recurring task rule", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let projectId = parsed.data.project_id === undefined ? existing.project_id : parsed.data.project_id;
  if (projectId) {
    const project = await validateContributableProjectScope(projectId, scope.workspaceId, auth);
    if (!project.ok) return project.response;
  }

  let taskId = parsed.data.task_id === undefined ? existing.task_id : parsed.data.task_id;
  if (taskId) {
    const task = await validateContributableTaskScope(taskId, scope.workspaceId, auth);
    if (!task.ok) return task.response;
    if (projectId && task.task.project_id !== projectId) {
      return NextResponse.json(
        { error: "Recurring task rule project must match the source task project" },
        { status: 400 },
      );
    }
    projectId = task.task.project_id;
  }

  const updated = await prisma.recurringTaskRule.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.rrule !== undefined && { rrule: parsed.data.rrule }),
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      ...(parsed.data.project_id !== undefined || parsed.data.task_id !== undefined
        ? { project_id: projectId, task_id: taskId }
        : {}),
    },
  });

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "recurring_task_rule_updated",
    entity_type: "recurring_task_rule",
    entity_id: updated.id,
    project_id: updated.project_id,
    task_id: updated.task_id,
    metadata: { name: updated.name, active: updated.active },
  });

  return NextResponse.json(updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;
  void req;

  const existing = await prisma.recurringTaskRule.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId },
    select: {
      id: true,
      name: true,
      workspace_id: true,
      project_id: true,
      task_id: true,
      created_by: true,
      project: { select: { id: true, workspace_id: true, owner_id: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Recurring task rule not found" }, { status: 404 });
  }
  if (!(await canManageRecurringRule(auth, existing))) {
    return NextResponse.json({ error: "Recurring task rule access required" }, { status: 403 });
  }

  await prisma.recurringTaskRule.delete({ where: { id: existing.id } });
  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "recurring_task_rule_deleted",
    entity_type: "recurring_task_rule",
    entity_id: existing.id,
    project_id: existing.project_id,
    task_id: existing.task_id,
    metadata: { name: existing.name },
  });

  return NextResponse.json({ success: true });
}

export const PATCH = withErrorReporting("api:recurring-task-rules/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:recurring-task-rules/id:DELETE", DELETE_handler);
