import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getUserId(session);

  const oldTask = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: { select: { owner_id: true } } },
  });
  if (!oldTask) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userRole = (session.user as { role?: string }).role;
  const isProjectOwner = oldTask.project.owner_id === userId;
  const isAssignee = oldTask.assignee_id === userId;
  if (!isProjectOwner && !isAssignee && userRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, status, priority, assignee_id, due_date, position } = body;

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(assignee_id !== undefined && { assignee_id: assignee_id || null }),
      ...(due_date !== undefined && { due_date: due_date ? new Date(due_date) : null }),
      ...(position !== undefined && { position }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });

  if (
    assignee_id &&
    assignee_id !== userId &&
    assignee_id !== oldTask.assignee_id
  ) {
    await prisma.notification.create({
      data: { type: "assigned", user_id: assignee_id, task_id: task.id },
    }).catch(() => {});
  }

  return NextResponse.json(task);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = getUserId(session);
  const userRole = (session.user as { role?: string }).role;

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: { select: { owner_id: true } } },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (task.project.owner_id !== userId && task.assignee_id !== userId && userRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
