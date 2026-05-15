import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, canAccessWorkspace } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.currentWorkspaceId) {
    return NextResponse.json([], { status: 200 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get("limit") || "500", 10) || 500),
    1000
  );
  const cursor = searchParams.get("cursor");

  const projects = await prisma.project.findMany({
    where: { workspace_id: auth.currentWorkspaceId },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
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
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

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
    if (space.workspace_id !== auth.currentWorkspaceId || !canAccessWorkspace(auth, space.workspace_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (folder_id) {
    const folder = await prisma.folder.findUnique({ where: { id: folder_id } });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 400 });
    if (folder.workspace_id !== auth.currentWorkspaceId || !canAccessWorkspace(auth, folder.workspace_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description || null,
      due_date: parsedDueDate,
      workspace_id: auth.currentWorkspaceId,
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
