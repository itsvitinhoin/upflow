import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, isSuperAdmin } from "@/lib/auth-helpers";
import { buildPage, parsePagination } from "@/lib/pagination";

// Returns every user who shares at least one workspace with the caller, so the
// UI can populate assignee pickers, team views, etc. Super-admins see all
// users in the system.
//
// Optional ?workspace_id= narrows the result to that workspace only (still
// requires the caller to be a member of that workspace, except super-admin).
export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceFilter = searchParams.get("workspace_id");
  const { limit, cursor } = parsePagination(req, { defaultLimit: 200, maxLimit: 500 });

  const superAdmin = isSuperAdmin(auth);

  let where: Prisma.UserWhereInput | undefined;

  if (workspaceFilter) {
    if (!superAdmin && !auth.memberships.some((m) => m.workspace_id === workspaceFilter)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    where = { memberships: { some: { workspace_id: workspaceFilter } } };
  } else if (!superAdmin) {
    const wsIds = auth.memberships.map((m) => m.workspace_id);
    if (wsIds.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }
    where = { memberships: { some: { workspace_id: { in: wsIds } } } };
  }
  // super-admin + no filter → no where clause, returns everyone.

  const rows = await prisma.user.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
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
        where: workspaceFilter
          ? { workspace_id: workspaceFilter }
          : superAdmin
            ? undefined
            : { workspace_id: { in: auth.memberships.map((m) => m.workspace_id) } },
        select: { workspace_id: true, role: true },
      },
    },
  });

  // Flatten memberships into `workspace_role` (active workspace) + `workspaces` list.
  const flattened = rows.map((u) => {
    const activeMembership = u.memberships.find(
      (m) => m.workspace_id === auth.currentWorkspaceId,
    );
    const { memberships: _mm, ...rest } = u;
    void _mm;
    return {
      ...rest,
      workspace_role: activeMembership?.role ?? null,
      workspaces: u.memberships.map((m) => ({
        workspace_id: m.workspace_id,
        role: m.role,
      })),
    };
  });

  return NextResponse.json(buildPage(flattened, limit));
}
