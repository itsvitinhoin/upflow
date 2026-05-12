import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const folder = await prisma.folder.findUnique({ where: { id: params.id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder.owner_id !== auth.prismaUser.id && auth.prismaUser.role !== "admin") {
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
    if (auth.prismaUser.role !== "admin" && space.owner_id !== auth.prismaUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const folder = await prisma.folder.findUnique({ where: { id: params.id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder.owner_id !== auth.prismaUser.id && auth.prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.folder.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
