import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const projects = await prisma.project.findMany({
    where:
      auth.prismaUser.role === "admin"
        ? undefined
        : { owner_id: auth.prismaUser.id },
    orderBy: { created_at: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      space: { select: { id: true, name: true, icon: true } },
      folder: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name?: string;
    description?: string;
    due_date?: string;
    space_id?: string | null;
    folder_id?: string | null;
  };
  const { name, description, due_date, space_id, folder_id } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let parsedDueDate: Date | null = null;
  if (due_date) {
    const d = new Date(due_date);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
    }
    parsedDueDate = d;
  }

  if (space_id) {
    const space = await prisma.space.findUnique({ where: { id: space_id } });
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
    if (auth.prismaUser.role !== "admin" && space.owner_id !== auth.prismaUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (folder_id) {
    const folder = await prisma.folder.findUnique({ where: { id: folder_id } });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 400 });
    if (auth.prismaUser.role !== "admin" && folder.owner_id !== auth.prismaUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description || null,
      due_date: parsedDueDate,
      owner_id: auth.prismaUser.id,
      space_id: space_id || null,
      folder_id: folder_id || null,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      space: { select: { id: true, name: true, icon: true } },
      folder: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
