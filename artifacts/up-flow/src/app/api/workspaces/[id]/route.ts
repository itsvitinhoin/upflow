import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { WORKSPACE_COOKIE } from "@/lib/workspace";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  void req;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const superAdmin = isSuperAdmin(auth);

  const workspace = await prisma.workspace.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!superAdmin) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: params.id,
          user_id: auth.prismaUser.id,
        },
      },
      select: { role: true, status: true },
    });
    if (membership?.role !== "owner" || membership.status !== "active") {
      return NextResponse.json(
        { error: "Only workspace owners can delete workspaces." },
        { status: 403 },
      );
    }

    const activeWorkspaceCount = await prisma.workspaceMember.count({
      where: { user_id: auth.prismaUser.id, status: "active" },
    });
    if (activeWorkspaceCount <= 1) {
      return NextResponse.json(
        { error: "Create another workspace before deleting your only workspace." },
        { status: 400 },
      );
    }
  }

  const nextWorkspace = await prisma.workspaceMember.findFirst({
    where: {
      user_id: auth.prismaUser.id,
      status: "active",
      workspace_id: { not: params.id },
    },
    orderBy: { created_at: "asc" },
    select: { workspace_id: true },
  });

  await prisma.workspace.delete({ where: { id: params.id } });

  const res = NextResponse.json({
    success: true,
    deleted_workspace_id: workspace.id,
    next_workspace_id: nextWorkspace?.workspace_id ?? null,
  });

  if (auth.currentWorkspaceId === params.id) {
    if (nextWorkspace?.workspace_id) {
      res.cookies.set(WORKSPACE_COOKIE, nextWorkspace.workspace_id, {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 365,
      });
    } else {
      res.cookies.set(WORKSPACE_COOKIE, "", {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        maxAge: 0,
      });
    }
  }

  return res;
}

export const DELETE = withErrorReporting("api:workspaces/id:DELETE", DELETE_handler);
