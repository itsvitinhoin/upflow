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
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  // Scope to the caller's active workspace — Space must belong to it.
  // Returning a flat 404 (rather than 403) keeps Spaces from other
  // workspaces invisible to the caller.
  const space = await prisma.space.findFirst({
    where: { id: params.id, workspace_id: auth.currentWorkspaceId },
    include: {
      workspace: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { projects: true } },
    },
  });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [folders, projects] = await Promise.all([
    prisma.folder.findMany({
      where: { space_id: space.id, workspace_id: space.workspace_id, parent_id: null },
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
    }),
    prisma.project.findMany({
      where: { space_id: space.id, folder_id: null },
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return NextResponse.json({
    space,
    folders,
    projects,
  });
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const space = await prisma.space.findUnique({ where: { id: params.id } });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Owner of the space OR an admin of the space's workspace can edit.
  if (space.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { name?: string; icon?: string | null; position?: number };
  let trimmedName: string | undefined;
  if (body.name !== undefined) {
    trimmedName = body.name.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
  }
  const updated = await prisma.space.update({
    where: { id: params.id },
    data: {
      ...(trimmedName !== undefined && { name: trimmedName }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.position !== undefined && { position: body.position }),
    },
    include: { _count: { select: { projects: true } } },
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

  const space = await prisma.space.findUnique({ where: { id: params.id } });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (space.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.space.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
export const GET = withErrorReporting("api:spaces/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:spaces/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:spaces/id:DELETE", DELETE_handler);
