import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const space = await prisma.space.findUnique({ where: { id: params.id } });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (space.owner_id !== auth.prismaUser.id && auth.prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { name?: string; icon?: string | null; position?: number };
  const updated = await prisma.space.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
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
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const space = await prisma.space.findUnique({ where: { id: params.id } });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (space.owner_id !== auth.prismaUser.id && auth.prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.space.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
