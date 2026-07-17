import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { ensureDepartmentSpaces, getDepartmentSpacePreset } from "@/lib/department-spaces";
import { prisma } from "@/lib/prisma";
import { withErrorReporting } from "@/lib/with-error-reporting";

type RouteContext = { params: Promise<{ id: string }> };

async function POST_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id } = await params;

  const space = await prisma.space.findFirst({
    where: { id, workspace_id: auth.currentWorkspaceId },
    select: { id: true, name: true, workspace_id: true },
  });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isWorkspaceAdminFor(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const preset = getDepartmentSpacePreset(space.name);
  if (!preset) {
    return NextResponse.json({ error: "Department defaults are not available for this Space" }, { status: 400 });
  }

  await ensureDepartmentSpaces(space.workspace_id, auth.prismaUser.id);
  return NextResponse.json({ ok: true, department_key: preset.department_key });
}

export const POST = withErrorReporting("api:spaces/id/department-defaults:POST", POST_handler);
