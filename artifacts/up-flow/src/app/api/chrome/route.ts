import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const unread = await prisma.notification.count({
    where: { user_id: auth.prismaUser.id, read: false },
  });

  return NextResponse.json({
    user: {
      id: auth.prismaUser.id,
      name: auth.prismaUser.name,
      email: auth.prismaUser.email,
      image: auth.prismaUser.avatar_url,
      role: auth.prismaUser.role,
      currentWorkspaceId: auth.currentWorkspaceId,
      currentRole: auth.currentRole,
      isSuperAdmin: isSuperAdmin(auth),
    },
    workspaces: auth.memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    })),
    current_workspace_id: auth.currentWorkspaceId,
    current_role: auth.currentRole,
    unread_notifications: unread,
  });
}

export const GET = withErrorReporting("api:chrome:GET", GET_handler);
