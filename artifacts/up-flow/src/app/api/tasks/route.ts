import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const mine = searchParams.get("mine") === "true";
  const userId = (session.user as any).id;

  const where: any = {};
  if (projectId) where.project_id = projectId;
  if (mine) where.assignee_id = userId;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ position: "asc" }, { created_at: "desc" }],
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      _count: { select: { comments: true, subtasks: true } },
    },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, status, priority, project_id, assignee_id, due_date, parent_id } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!project_id) return NextResponse.json({ error: "project_id is required" }, { status: 400 });

  const userId = (session.user as any).id;

  // Get position (append to end of column)
  const lastTask = await prisma.task.findFirst({
    where: { project_id, status: status || "todo" },
    orderBy: { position: "desc" },
  });
  const position = (lastTask?.position ?? -1) + 1;

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description || null,
      status: status || "todo",
      priority: priority || "medium",
      project_id,
      assignee_id: assignee_id || null,
      due_date: due_date ? new Date(due_date) : null,
      parent_id: parent_id || null,
      position,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });

  // Create notification if assigned to someone else
  if (assignee_id && assignee_id !== userId) {
    await prisma.notification.create({
      data: {
        type: "assigned",
        user_id: assignee_id,
        task_id: task.id,
      },
    }).catch(() => {});
  }

  return NextResponse.json(task, { status: 201 });
}
