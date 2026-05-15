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

export async function DELETE(
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
