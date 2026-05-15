import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, canAccessWorkspace } from "@/lib/auth-helpers";
import { broadcastNotification } from "@/lib/supabase-server";
import { buildPage, parsePagination } from "@/lib/pagination";
import { logError } from "@/lib/log-error";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("task_id");
  if (!taskId) return NextResponse.json({ error: "task_id required" }, { status: 400 });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { project: { select: { workspace_id: true } } },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, task.project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { limit, cursor } = parsePagination(req, { defaultLimit: 100, maxLimit: 500 });

  const rows = await prisma.comment.findMany({
    where: { task_id: taskId, parent_id: null },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    include: {
      author: { select: { id: true, name: true, email: true } },
      replies: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });

  return NextResponse.json(buildPage(rows, limit));
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

  const taskRecord = await prisma.task.findUnique({
    where: { id: task_id },
    select: { project: { select: { workspace_id: true } } },
  });
  if (!taskRecord) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!canAccessWorkspace(auth, taskRecord.project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parent_id) {
    const parent = await prisma.comment.findUnique({
      where: { id: parent_id },
      select: { task_id: true },
    });
    if (!parent || parent.task_id !== task_id) {
      return NextResponse.json(
        { error: "Reply parent must belong to the same task" },
        { status: 400 }
      );
    }
  }

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
      .catch((err) => logError("api:comments:notify", err, { task_id }));
    await broadcastNotification(task.assignee_id);
  }

  return NextResponse.json(comment, { status: 201 });
}
