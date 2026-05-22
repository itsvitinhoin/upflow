import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({
      workspace: null,
      current_role: null,
      is_super_admin: isSuperAdmin(auth),
      members: [],
      departments: [],
    });
  }

  const [workspace, members, departments] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: auth.currentWorkspaceId },
      select: { id: true, name: true, slug: true },
    }),
    prisma.user.findMany({
      where: {
        memberships: { some: { workspace_id: auth.currentWorkspaceId } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        avatar_url: true,
        role: true,
        created_at: true,
        _count: { select: { tasks: true, projects: true } },
        memberships: {
          where: { workspace_id: auth.currentWorkspaceId },
          select: {
            workspace_id: true,
            role: true,
            status: true,
            department_id: true,
          },
        },
      },
    }),
    prisma.department.findMany({
      where: { workspace_id: auth.currentWorkspaceId },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        sort_order: true,
        created_at: true,
        _count: { select: { members: true } },
      },
    }),
  ]);

  const flattenedMembers = members.map((member) => {
    const activeMembership = member.memberships[0] ?? null;
    const { memberships: _memberships, ...rest } = member;
    void _memberships;
    return {
      ...rest,
      workspace_role: activeMembership?.role ?? null,
      workspace_status: activeMembership?.status ?? null,
      department_id: activeMembership?.department_id ?? null,
      workspaces: activeMembership
        ? [
            {
              workspace_id: activeMembership.workspace_id,
              role: activeMembership.role,
              status: activeMembership.status,
              department_id: activeMembership.department_id,
            },
          ]
        : [],
    };
  });

  return NextResponse.json({
    workspace,
    current_role: auth.currentRole,
    is_super_admin: isSuperAdmin(auth),
    members: flattenedMembers,
    departments,
  });
}

export const GET = withErrorReporting("api:team/overview:GET", GET_handler);
