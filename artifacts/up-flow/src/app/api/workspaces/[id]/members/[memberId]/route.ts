import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, isSuperAdmin, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const UpdateMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member", "guest"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  department_id: z.string().uuid().nullable().optional(),
});

async function loadMembership(workspaceId: string, userId: string) {
  return prisma.workspaceMember.findUnique({
    where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: userId } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

async function hasOtherActiveOwner(workspaceId: string, userId: string) {
  const owner = await prisma.workspaceMember.findFirst({
    where: {
      workspace_id: workspaceId,
      user_id: { not: userId },
      role: "owner",
      status: "active",
    },
    select: { id: true },
  });
  return Boolean(owner);
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!canAccessWorkspace(auth, params.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isWorkspaceAdminFor(auth, params.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = UpdateMemberSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid member update", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const membership = await loadMembership(params.id, params.memberId);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.role === "owner" && !isSuperAdmin(auth) && auth.currentRole !== "owner") {
    return NextResponse.json({ error: "Only owners can promote owners" }, { status: 403 });
  }
  if (membership.role === "owner" && parsed.data.role && parsed.data.role !== "owner" && auth.prismaUser.id === params.memberId) {
    return NextResponse.json({ error: "You cannot demote yourself as owner" }, { status: 400 });
  }
  if (parsed.data.status === "inactive" && auth.prismaUser.id === params.memberId) {
    return NextResponse.json({ error: "You cannot deactivate yourself" }, { status: 400 });
  }
  const ownerWouldLoseAccess =
    membership.role === "owner" &&
    ((parsed.data.role !== undefined && parsed.data.role !== "owner") ||
      parsed.data.status === "inactive");
  if (ownerWouldLoseAccess && !(await hasOtherActiveOwner(params.id, params.memberId))) {
    return NextResponse.json(
      { error: "You cannot leave this workspace without an active owner" },
      { status: 400 },
    );
  }

  if (parsed.data.department_id) {
    const department = await prisma.department.findUnique({
      where: { id: parsed.data.department_id },
      select: { workspace_id: true },
    });
    if (!department || department.workspace_id !== params.id) {
      return NextResponse.json({ error: "Department not found" }, { status: 400 });
    }
  }

  const updated = await prisma.workspaceMember.update({
    where: { workspace_id_user_id: { workspace_id: params.id, user_id: params.memberId } },
    data: {
      ...(parsed.data.role !== undefined && { role: parsed.data.role }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
      ...(parsed.data.department_id !== undefined && { department_id: parsed.data.department_id }),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await recordActivity({
    workspace_id: params.id,
    actor_id: auth.prismaUser.id,
    type: "workspace_member_updated",
    entity_type: "user",
    entity_id: params.memberId,
    metadata: {
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      status: updated.status,
    },
  });

  return NextResponse.json({
    success: true,
    user_id: updated.user_id,
    role: updated.role,
    status: updated.status,
    department_id: updated.department_id,
  });
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } },
) {
  void req;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!canAccessWorkspace(auth, params.id) || !isWorkspaceAdminFor(auth, params.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (auth.prismaUser.id === params.memberId) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const membership = await loadMembership(params.id, params.memberId);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (membership.role === "owner" && !isSuperAdmin(auth) && auth.currentRole !== "owner") {
    return NextResponse.json({ error: "Only owners can remove owners" }, { status: 403 });
  }
  if (membership.role === "owner" && !(await hasOtherActiveOwner(params.id, params.memberId))) {
    return NextResponse.json(
      { error: "You cannot leave this workspace without an active owner" },
      { status: 400 },
    );
  }

  await prisma.workspaceMember.delete({
    where: { workspace_id_user_id: { workspace_id: params.id, user_id: params.memberId } },
  });

  await recordActivity({
    workspace_id: params.id,
    actor_id: auth.prismaUser.id,
    type: "workspace_member_removed",
    entity_type: "user",
    entity_id: params.memberId,
    metadata: { name: membership.user.name, email: membership.user.email },
  });

  return NextResponse.json({ success: true });
}

export const PATCH = withErrorReporting("api:workspaces/members:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:workspaces/members:DELETE", DELETE_handler);
