import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({
      tasks: { items: [], nextCursor: null },
      projects: { items: [], nextCursor: null },
      users: { items: [], nextCursor: null },
    });
  }

  const superAdmin = isSuperAdmin(auth);
  const userWhere: Prisma.UserWhereInput | undefined = superAdmin
    ? undefined
    : {
        memberships: {
          some: { workspace_id: { in: auth.memberships.map((m) => m.workspace_id) } },
        },
      };

  const [tasks, projects, users] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignee_id: auth.prismaUser.id,
        project: { workspace_id: auth.currentWorkspaceId },
      },
      take: 500,
      orderBy: [{ position: "asc" }, { created_at: "desc" }, { id: "asc" }],
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        custom_field_values: {
          select: { definition_id: true, value: true },
        },
        _count: { select: { comments: true, subtasks: true } },
      },
    }),
    prisma.project.findMany({
      where: { workspace_id: auth.currentWorkspaceId },
      take: 200,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        space: { select: { id: true, name: true, icon: true } },
        folder: { select: { id: true, name: true, icon: true } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.user.findMany({
      where: userWhere,
      take: 200,
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
          where: superAdmin
            ? undefined
            : { workspace_id: { in: auth.memberships.map((m) => m.workspace_id) } },
          select: {
            workspace_id: true,
            role: true,
            department_id: true,
          },
        },
      },
    }),
  ]);

  const flattenedUsers = users.map((u) => {
    const activeMembership = u.memberships.find(
      (m) => m.workspace_id === auth.currentWorkspaceId,
    );
    const { memberships: _memberships, ...rest } = u;
    void _memberships;
    return {
      ...rest,
      workspace_role: activeMembership?.role ?? null,
      department_id: activeMembership?.department_id ?? null,
      workspaces: u.memberships.map((m) => ({
        workspace_id: m.workspace_id,
        role: m.role,
        department_id: m.department_id,
      })),
    };
  });

  return NextResponse.json({
    tasks: { items: tasks, nextCursor: null },
    projects: { items: projects, nextCursor: null },
    users: { items: flattenedUsers, nextCursor: null },
  });
}

export const GET = withErrorReporting("api:dashboard:GET", GET_handler);
