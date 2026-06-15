import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { requireCurrentWorkspace, validateProjectScope, validateTaskScope } from "@/lib/api/scope";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const RecurringRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rrule: z.string().trim().min(6).max(500).refine((value) => value.includes("FREQ="), {
    message: "Use an RRULE string that includes FREQ, for example FREQ=WEEKLY;INTERVAL=1",
  }),
  project_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  active: z.boolean().optional(),
});

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const taskId = searchParams.get("task_id");
  const { limit, cursor } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 });

  const rows = await prisma.recurringTaskRule.findMany({
    where: {
      workspace_id: scope.workspaceId,
      ...(projectId ? { project_id: projectId } : {}),
      ...(taskId ? { task_id: taskId } : {}),
    },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ updated_at: "desc" }, { id: "asc" }],
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, status: true, due_date: true } },
      creator: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(buildPage(rows, limit));
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const parsed = RecurringRuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid recurring task rule", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let projectId = parsed.data.project_id ?? null;
  if (projectId) {
    const project = await validateProjectScope(projectId, scope.workspaceId);
    if (!project.ok) return project.response;
  }

  if (parsed.data.task_id) {
    const task = await validateTaskScope(parsed.data.task_id, scope.workspaceId);
    if (!task.ok) return task.response;
    if (projectId && task.task.project_id !== projectId) {
      return NextResponse.json(
        { error: "Recurring task rule project must match the source task project" },
        { status: 400 },
      );
    }
    projectId = task.task.project_id;
  }

  const rule = await prisma.recurringTaskRule.create({
    data: {
      workspace_id: scope.workspaceId,
      project_id: projectId,
      task_id: parsed.data.task_id ?? null,
      name: parsed.data.name,
      rrule: parsed.data.rrule,
      active: parsed.data.active ?? true,
      created_by: auth.prismaUser.id,
    },
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, status: true, due_date: true } },
    },
  });

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "recurring_task_rule_created",
    entity_type: "recurring_task_rule",
    entity_id: rule.id,
    project_id: rule.project_id,
    task_id: rule.task_id,
    metadata: { name: rule.name, rrule: rule.rrule },
  });

  return NextResponse.json(rule, { status: 201 });
}

export const GET = withErrorReporting("api:recurring-task-rules:GET", GET_handler);
export const POST = withErrorReporting("api:recurring-task-rules:POST", POST_handler);
