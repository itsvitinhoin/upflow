import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { isValidDepartmentColor } from "@/lib/department-colors";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workspaces/[id]/departments — list departments in the workspace.
// Any member of the workspace can read.
async function GET_handler(
  _req: NextRequest,
  { params }: RouteContext,
) {
  const { id: workspaceId } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!canAccessWorkspace(auth, workspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const departments = await prisma.department.findMany({
    where: { workspace_id: workspaceId },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      sort_order: true,
      created_at: true,
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({ items: departments });
}

// POST /api/workspaces/[id]/departments — admin only.
async function POST_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const { id: workspaceId } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!isWorkspaceAdminFor(auth, workspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    color?: string;
  };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (name.length > 60) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 });
  }
  // Color is optional on create; default to "slate" if omitted, but reject
  // unknown values outright (matches PATCH semantics so clients see one
  // consistent contract).
  const color = body.color === undefined ? "slate" : body.color;
  if (!isValidDepartmentColor(color)) {
    return NextResponse.json({ error: "Invalid color" }, { status: 400 });
  }

  // Place new department at the end of the existing order.
  const last = await prisma.department.findFirst({
    where: { workspace_id: workspaceId },
    orderBy: { sort_order: "desc" },
    select: { sort_order: true },
  });
  const nextOrder = (last?.sort_order ?? -1) + 1;

  try {
    const dep = await prisma.department.create({
      data: {
        workspace_id: workspaceId,
        name,
        color,
        sort_order: nextOrder,
      },
      select: {
        id: true,
        name: true,
        color: true,
        sort_order: true,
        created_at: true,
      },
    });
    return NextResponse.json({ ...dep, _count: { members: 0 } }, { status: 201 });
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

export const GET = withErrorReporting(
  "api:workspaces/departments:GET",
  GET_handler,
);
export const POST = withErrorReporting(
  "api:workspaces/departments:POST",
  POST_handler,
);
