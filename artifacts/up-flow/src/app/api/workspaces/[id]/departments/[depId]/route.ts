import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { isValidDepartmentColor } from "@/lib/department-colors";

type RouteContext = { params: Promise<{ id: string; depId: string }> };

// PATCH /api/workspaces/[id]/departments/[depId] — rename / recolor.
async function PATCH_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const { id, depId } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!isWorkspaceAdminFor(auth, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.department.findUnique({
    where: { id: depId },
    select: { workspace_id: true },
  });
  if (!existing || existing.workspace_id !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    color?: string;
  };
  const data: { name?: string; color?: string } = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (trimmed.length > 60) {
      return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    }
    data.name = trimmed;
  }
  if (typeof body.color === "string") {
    if (!isValidDepartmentColor(body.color)) {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    data.color = body.color;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const dep = await prisma.department.update({
      where: { id: depId },
      data,
      select: {
        id: true,
        name: true,
        color: true,
        sort_order: true,
        created_at: true,
        _count: { select: { members: true } },
      },
    });
    return NextResponse.json(dep);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A department with that name already exists" },
        { status: 409 },
      );
    }
    throw err;
  }
}

// DELETE — members in the department fall back to "Unassigned" via SetNull.
async function DELETE_handler(
  _req: NextRequest,
  { params }: RouteContext,
) {
  const { id, depId } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!isWorkspaceAdminFor(auth, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.department.findUnique({
    where: { id: depId },
    select: { workspace_id: true },
  });
  if (!existing || existing.workspace_id !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.department.delete({ where: { id: depId } });
  return NextResponse.json({ success: true });
}

export const PATCH = withErrorReporting(
  "api:workspaces/departments/[depId]:PATCH",
  PATCH_handler,
);
export const DELETE = withErrorReporting(
  "api:workspaces/departments/[depId]:DELETE",
  DELETE_handler,
);
