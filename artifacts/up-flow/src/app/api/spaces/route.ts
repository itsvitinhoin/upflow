import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const spaces = await prisma.space.findMany({
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { projects: true } },
    },
  });

  return NextResponse.json(spaces);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string; icon?: string | null };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const last = await prisma.space.findFirst({ orderBy: { position: "desc" } });
  const position = (last?.position ?? -1) + 1;

  const space = await prisma.space.create({
    data: {
      name,
      icon: body.icon ?? null,
      owner_id: auth.prismaUser.id,
      position,
    },
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json(space, { status: 201 });
}
