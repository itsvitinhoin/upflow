import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

// PUT /api/workspaces/[id]/members/[memberId]/department
// Body: { department_id: string | null }
// memberId is the *user* id (matches what /api/users returns).
async function PUT_handler(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!isWorkspaceAdminFor(auth, params.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    department_id?: string | null;
  };
  const departmentId =
    body.department_id === null || body.department_id === undefined
      ? null
      : String(body.department_id);

  // Validate department belongs to this workspace, if provided.
  if (departmentId) {
    const dep = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { workspace_id: true },
    });
    if (!dep || dep.workspace_id !== params.id) {
      return NextResponse.json(
        { error: "Department not found in this workspace" },
        { status: 400 },
      );
    }
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspace_id_user_id: {
        workspace_id: params.id,
        user_id: params.memberId,
      },
    },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await prisma.workspaceMember.update({
    where: { id: membership.id },
    data: { department_id: departmentId },
  });

  return NextResponse.json({ success: true, department_id: departmentId });
}

export const PUT = withErrorReporting(
  "api:workspaces/members/department:PUT",
  PUT_handler,
);
