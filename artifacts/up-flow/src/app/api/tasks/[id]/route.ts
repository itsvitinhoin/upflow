import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      subtasks: {
        include: { assignee: { select: { id: true, name: true, email: true } } },
        orderBy: { created_at: "asc" },
      },
      comments: {
        where: { parent_id: null },
        include: {
          author: { select: { id: true, name: true } },
          replies: {
            include: { author: { select: { id: true, name: true } } },
            orderBy: { created_at: "asc" },
          },
        },
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
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prismaUser } = auth;

  const oldTask = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: { select: { owner_id: true } } },
  });
  if (!oldTask) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isProjectOwner = oldTask.project.owner_id === prismaUser.id;
  const isAssignee = oldTask.assignee_id === prismaUser.id;
  if (!isProjectOwner && !isAssignee && prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assignee_id?: string | null;
    due_date?: string | null;
    position?: number;
  };
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

  if (assignee_id && assignee_id !== prismaUser.id && assignee_id !== oldTask.assignee_id) {
    await prisma.notification
      .create({ data: { type: "assigned", user_id: assignee_id, task_id: task.id } })
      .catch(() => {});
  }

  return NextResponse.json(task);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const { prismaUser } = auth;

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: { select: { owner_id: true } } },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    task.project.owner_id !== prismaUser.id &&
    task.assignee_id !== prismaUser.id &&
    prismaUser.role !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
