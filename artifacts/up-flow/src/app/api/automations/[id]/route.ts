import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { requireCurrentWorkspace, requireWorkspaceAdmin } from "@/lib/api/scope";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const UpdateAutomationRuleSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  trigger: z.enum([
    "task_overdue",
    "task_done",
    "project_inactive",
    "client_created",
    "meeting_created",
  ]).optional(),
  action: z.object({
    type: z.enum(["notify_user", "notify_project_owner", "apply_template", "create_task"]),
    config: z.record(z.unknown()).default({}),
  }).optional(),
  active: z.boolean().optional(),
});

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;
  const admin = requireWorkspaceAdmin(auth, scope.workspaceId);
  if (!admin.ok) return admin.response;

  const existing = await prisma.automationRule.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Automation rule not found" }, { status: 404 });

  const parsed = UpdateAutomationRuleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid automation rule", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await prisma.automationRule.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.trigger !== undefined && { trigger: parsed.data.trigger }),
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      ...(parsed.data.action !== undefined && {
        action: parsed.data.action as Prisma.InputJsonValue,
      }),
    },
  });

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "automation_rule_updated",
    entity_type: "automation_rule",
    entity_id: updated.id,
    metadata: { name: updated.name, trigger: updated.trigger, active: updated.active },
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
  const admin = requireWorkspaceAdmin(auth, scope.workspaceId);
  if (!admin.ok) return admin.response;
  void req;

  const existing = await prisma.automationRule.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId },
    select: { id: true, name: true, trigger: true },
  });
  if (!existing) return NextResponse.json({ error: "Automation rule not found" }, { status: 404 });

  await prisma.automationRule.delete({ where: { id: existing.id } });
  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "automation_rule_deleted",
    entity_type: "automation_rule",
    entity_id: existing.id,
    metadata: { name: existing.name, trigger: existing.trigger },
  });

  return NextResponse.json({ success: true });
}

export const PATCH = withErrorReporting("api:automations/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:automations/id:DELETE", DELETE_handler);
