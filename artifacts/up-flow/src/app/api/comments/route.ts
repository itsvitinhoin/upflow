import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";
import { broadcastNotification } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("task_id");

  if (!taskId) return NextResponse.json({ error: "task_id required" }, { status: 400 });

  const comments = await prisma.comment.findMany({
    where: { task_id: taskId, parent_id: null },
    orderBy: { created_at: "asc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
      replies: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    task_id?: string;
    body?: string;
    parent_id?: string;
  };
  const { task_id, body: commentBody, parent_id } = body;

  if (!task_id || !commentBody?.trim()) {
    return NextResponse.json({ error: "task_id and body are required" }, { status: 400 });
  }

  const userId = auth.prismaUser.id;

  const comment = await prisma.comment.create({
    data: {
      task_id,
      body: commentBody.trim(),
      author_id: userId,
      parent_id: parent_id || null,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      replies: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });

  const task = await prisma.task.findUnique({ where: { id: task_id } });
  if (task?.assignee_id && task.assignee_id !== userId) {
    await prisma.notification
      .create({ data: { type: "commented", user_id: task.assignee_id, task_id } })
      .catch(() => {});
    await broadcastNotification(task.assignee_id);
  }

  return NextResponse.json(comment, { status: 201 });
}
