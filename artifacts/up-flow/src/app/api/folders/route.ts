import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const folders = await prisma.folder.findMany({
    where:
      auth.prismaUser.role === "admin"
        ? undefined
        : { owner_id: auth.prismaUser.id },
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
    include: {
      _count: { select: { projects: true } },
    },
  });

  return NextResponse.json(folders);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    icon?: string | null;
    space_id?: string;
  };
  const name = body.name?.trim();
  const space_id = body.space_id;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!space_id) return NextResponse.json({ error: "space_id is required" }, { status: 400 });

  const space = await prisma.space.findUnique({ where: { id: space_id } });
  if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
  if (auth.prismaUser.role !== "admin" && space.owner_id !== auth.prismaUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const last = await prisma.folder.findFirst({
    where: { space_id },
    orderBy: { position: "desc" },
  });
  const position = (last?.position ?? -1) + 1;

  const folder = await prisma.folder.create({
    data: {
      name,
      icon: body.icon ?? null,
      space_id,
      owner_id: auth.prismaUser.id,
      position,
    },
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json(folder, { status: 201 });
}
