import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireCurrentWorkspace, requireWorkspaceAdmin } from "@/lib/api/scope";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const GoalStatusSchema = z.enum(["active", "paused", "completed", "archived"]);

const UpdateGoalSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  status: GoalStatusSchema.optional(),
  target_value: z.number().finite().nonnegative().optional().nullable(),
  current_value: z.number().finite().nonnegative().optional(),
  due_date: z.string().datetime().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
});

function canManageGoal(
  authUserId: string,
  isAdmin: boolean,
  goal: { owner_id: string | null },
) {
  return isAdmin || goal.owner_id === authUserId;
}

async function validateGoalOwner(ownerId: string | null | undefined, workspaceId: string) {
  if (!ownerId) return { ok: true as const, ownerId: null };
  const member = await prisma.workspaceMember.findFirst({
    where: { workspace_id: workspaceId, user_id: ownerId, status: "active" },
    select: { user_id: true },
  });
  if (!member) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Goal owner must be an active member of this workspace" },
        { status: 400 },
      ),
    };
  }
  return { ok: true as const, ownerId: member.user_id };
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

  const existing = await prisma.goal.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const isAdmin = isWorkspaceAdminFor(auth, scope.workspaceId);
  if (!canManageGoal(auth.prismaUser.id, isAdmin, existing)) {
    return NextResponse.json(
      { error: "Goal owner or workspace admin access required" },
      { status: 403 },
    );
  }

  const parsed = UpdateGoalSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid goal", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let ownerId = existing.owner_id;
  if (parsed.data.owner_id !== undefined) {
    const admin = requireWorkspaceAdmin(auth, scope.workspaceId);
    if (!admin.ok) return admin.response;
    const owner = await validateGoalOwner(parsed.data.owner_id, scope.workspaceId);
    if (!owner.ok) return owner.response;
    ownerId = owner.ownerId;
  }

  const updated = await prisma.goal.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description || null }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.target_value !== undefined && { target_value: parsed.data.target_value }),
      ...(parsed.data.current_value !== undefined && { current_value: parsed.data.current_value }),
      ...(parsed.data.due_date !== undefined && {
        due_date: parsed.data.due_date ? new Date(parsed.data.due_date) : null,
      }),
      ...(parsed.data.owner_id !== undefined && { owner_id: ownerId }),
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "goal_updated",
    entity_type: "goal",
    entity_id: updated.id,
    metadata: { name: updated.name, status: updated.status, owner_id: updated.owner_id },
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

  const existing = await prisma.goal.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId },
    select: { id: true, name: true, status: true, owner_id: true },
  });
  if (!existing) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const isAdmin = isWorkspaceAdminFor(auth, scope.workspaceId);
  if (!canManageGoal(auth.prismaUser.id, isAdmin, existing)) {
    return NextResponse.json(
      { error: "Goal owner or workspace admin access required" },
      { status: 403 },
    );
  }

  await prisma.goal.delete({ where: { id: existing.id } });
  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "goal_deleted",
    entity_type: "goal",
    entity_id: existing.id,
    metadata: { name: existing.name, status: existing.status, owner_id: existing.owner_id },
  });

  return NextResponse.json({ success: true });
}

export const PATCH = withErrorReporting("api:goals/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:goals/id:DELETE", DELETE_handler);
