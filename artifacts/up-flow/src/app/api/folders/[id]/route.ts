import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const folder = await prisma.folder.findUnique({ where: { id: params.id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, folder.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (folder.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, folder.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    icon?: string | null;
    position?: number;
    space_id?: string;
  };
  let trimmedName: string | undefined;
  if (body.name !== undefined) {
    trimmedName = body.name.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
  }
  if (body.space_id) {
    const space = await prisma.space.findUnique({ where: { id: body.space_id } });
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
    if (space.workspace_id !== folder.workspace_id) {
      return NextResponse.json(
        { error: "Cannot move folder across workspaces" },
        { status: 400 },
      );
    }
  }
  const updated = await prisma.folder.update({
    where: { id: params.id },
    data: {
      ...(trimmedName !== undefined && { name: trimmedName }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.position !== undefined && { position: body.position }),
      ...(body.space_id !== undefined && { space_id: body.space_id }),
    },
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const folder = await prisma.folder.findUnique({ where: { id: params.id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, folder.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (folder.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, folder.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.folder.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
