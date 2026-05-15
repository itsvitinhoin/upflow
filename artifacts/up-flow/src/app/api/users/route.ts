import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, isWorkspaceAdmin } from "@/lib/auth-helpers";

// Returns the fellow members of the caller's active workspace, so the UI
// can populate assignee pickers, team views, etc. Workspace admins see
// additional fields (role, counts).
export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.currentWorkspaceId) {
    return NextResponse.json([], { status: 200 });
  }
  void req;

  const isAdmin = isWorkspaceAdmin(auth);

  const members = await prisma.workspaceMember.findMany({
    where: { workspace_id: auth.currentWorkspaceId },
    orderBy: { created_at: "asc" },
    select: {
      role: true,
      created_at: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar_url: true,
          ...(isAdmin && {
            role: true,
            created_at: true,
            _count: { select: { tasks: true, projects: true } },
          }),
        },
      },
    },
  });

  // Flatten to the shape the existing UI expects.
  const users = members.map((m) => ({
    ...m.user,
    workspace_role: m.role,
  }));

  return NextResponse.json(users);
}
