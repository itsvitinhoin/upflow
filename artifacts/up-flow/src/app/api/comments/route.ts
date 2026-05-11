import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { broadcastNotification } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("task_id");

  if (!taskId) return NextResponse.json({ error: "task_id required" }, { status: 400 });

  const comments = await prisma.comment.findMany({
    where: { task_id: taskId },
    orderBy: { created_at: "asc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { task_id?: string; body?: string };
  const { task_id, body: commentBody } = body;

  if (!task_id || !commentBody?.trim()) {
    return NextResponse.json({ error: "task_id and body are required" }, { status: 400 });
  }

  const userId = getUserId(session);

  const comment = await prisma.comment.create({
    data: {
      task_id,
      body: commentBody.trim(),
      author_id: userId,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  const task = await prisma.task.findUnique({ where: { id: task_id } });
  if (task?.assignee_id && task.assignee_id !== userId) {
    await prisma.notification.create({
      data: { type: "commented", user_id: task.assignee_id, task_id },
    }).catch(() => {});
    await broadcastNotification(task.assignee_id);
  }

  return NextResponse.json(comment, { status: 201 });
}
