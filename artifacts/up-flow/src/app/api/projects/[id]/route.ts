import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { tasks: true, docs: true } },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(project);
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (project.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    name?: string;
    description?: string;
    status?: string;
    due_date?: string | null;
    space_id?: string | null;
    folder_id?: string | null;
  };
  const { name, description, status, due_date, space_id, folder_id } = body;

  if (space_id) {
    const space = await prisma.space.findUnique({ where: { id: space_id } });
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
    if (space.workspace_id !== project.workspace_id) {
      return NextResponse.json({ error: "Cannot move across workspaces" }, { status: 400 });
    }
  }
  if (folder_id) {
    const folder = await prisma.folder.findUnique({ where: { id: folder_id } });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 400 });
    if (folder.workspace_id !== project.workspace_id) {
      return NextResponse.json({ error: "Cannot move across workspaces" }, { status: 400 });
    }
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status: status as "active" | "archived" }),
      ...(due_date !== undefined && { due_date: due_date ? new Date(due_date) : null }),
      ...(space_id !== undefined && { space_id: space_id || null }),
      ...(folder_id !== undefined && { folder_id: folder_id || null }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      space: { select: { id: true, name: true, icon: true } },
      folder: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json(updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (project.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
export const GET = withErrorReporting("api:projects/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:projects/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:projects/id:DELETE", DELETE_handler);
