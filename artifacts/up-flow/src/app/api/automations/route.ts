import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { requireCurrentWorkspace, requireWorkspaceAdmin } from "@/lib/api/scope";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const AutomationRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  trigger: z.enum([
    "task_overdue",
    "task_done",
    "project_inactive",
    "client_created",
    "meeting_created",
  ]),
  action: z.object({
    type: z.enum(["notify_user", "notify_project_owner", "apply_template", "create_task"]),
    config: z.record(z.unknown()).default({}),
  }),
  active: z.boolean().optional(),
});

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const { limit, cursor } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 });
  const rows = await prisma.automationRule.findMany({
    where: { workspace_id: scope.workspaceId },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ updated_at: "desc" }, { id: "asc" }],
    include: { creator: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(buildPage(rows, limit));
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;
  const admin = requireWorkspaceAdmin(auth, scope.workspaceId);
  if (!admin.ok) return admin.response;

  const parsed = AutomationRuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid automation rule", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const rule = await prisma.automationRule.create({
    data: {
      workspace_id: scope.workspaceId,
      name: parsed.data.name,
      trigger: parsed.data.trigger,
      action: parsed.data.action as Prisma.InputJsonValue,
      active: parsed.data.active ?? true,
      created_by: auth.prismaUser.id,
    },
  });

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "automation_rule_created",
    entity_type: "automation_rule",
    entity_id: rule.id,
    metadata: { name: rule.name, trigger: rule.trigger, active: rule.active },
  });

  return NextResponse.json(rule, { status: 201 });
}

export const GET = withErrorReporting("api:automations:GET", GET_handler);
export const POST = withErrorReporting("api:automations:POST", POST_handler);
