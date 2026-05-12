import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";
import { broadcastNotification } from "@/lib/supabase-server";
import type { TaskStatus, TaskPriority } from "@prisma/client";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const mine = searchParams.get("mine") === "true";
  const parentId = searchParams.get("parent_id");

  const where: {
    project_id?: string;
    assignee_id?: string;
    parent_id?: string | null;
  } = {};
  if (projectId) where.project_id = projectId;
  if (mine) where.assignee_id = auth.prismaUser.id;
  if (parentId) where.parent_id = parentId;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ position: "asc" }, { created_at: "desc" }],
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      custom_field_values: {
        select: { definition_id: true, value: true },
      },
      _count: { select: { comments: true, subtasks: true } },
    },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    project_id?: string;
    assignee_id?: string;
    due_date?: string;
    parent_id?: string;
  };

  const { title, description, status, priority, project_id, assignee_id, due_date, parent_id } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!project_id) return NextResponse.json({ error: "project_id is required" }, { status: 400 });

  const userId = auth.prismaUser.id;

  const lastTask = await prisma.task.findFirst({
    where: { project_id, status: status ?? "todo" },
    orderBy: { position: "desc" },
  });
  const position = (lastTask?.position ?? -1) + 1;

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description || null,
      status: status ?? "todo",
      priority: priority ?? "medium",
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

  if (assignee_id && assignee_id !== userId) {
    await prisma.notification
      .create({ data: { type: "assigned", user_id: assignee_id, task_id: task.id } })
      .catch(() => {});
    await broadcastNotification(assignee_id);
  }

  return NextResponse.json(task, { status: 201 });
}
