import { NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { broadcastNotification } from "@/lib/supabase-server";

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true, workspace_id: true } },
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
  if (!canAccessWorkspace(auth, task.project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(task);
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const { prismaUser } = auth;

  const oldTask = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: { select: { workspace_id: true, owner_id: true } } },
  });
  if (!oldTask) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, oldTask.project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isProjectOwner = oldTask.project.owner_id === prismaUser.id;
  const isAssignee = oldTask.assignee_id === prismaUser.id;
  if (!isProjectOwner && !isAssignee && !isWorkspaceAdminFor(auth, oldTask.project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee_id?: string | null;
    due_date?: string | null;
    position?: number;
  };
  const { title, description, status, priority, assignee_id, due_date, position } = body;

  if (assignee_id) {
    const ok = await prisma.workspaceMember.findFirst({
      where: { workspace_id: oldTask.project.workspace_id, user_id: assignee_id },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Assignee is not a member of this workspace" },
        { status: 400 },
      );
    }
  }

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
      .catch((err) => logError("api:tasks:PATCH:notify", err, { task_id: task.id }));
    await broadcastNotification(assignee_id);
  }

  // Status-change notifications. Notify the project owner (creator) and the
  // task's assignee — excluding whoever made the change, and skipping
  // duplicates when those are the same person.
  if (status !== undefined && status !== oldTask.status) {
    const recipients = new Set<string>();
    if (oldTask.project.owner_id && oldTask.project.owner_id !== prismaUser.id) {
      recipients.add(oldTask.project.owner_id);
    }
    // Use the post-update assignee so a status change combined with a
    // re-assignment still notifies the new assignee about the new status.
    const currentAssignee = task.assignee_id;
    if (currentAssignee && currentAssignee !== prismaUser.id) {
      recipients.add(currentAssignee);
    }

    const payload = {
      old_status: oldTask.status,
      new_status: status,
      task_title: task.title,
      actor_id: prismaUser.id,
      actor_name: prismaUser.name,
    };

    for (const userId of recipients) {
      await prisma.notification
        .create({
          data: {
            type: "status_changed",
            user_id: userId,
            task_id: task.id,
            data: payload,
          },
        })
        .catch((err) =>
          logError("api:tasks:PATCH:status-notify", err, { task_id: task.id, user_id: userId }),
        );
      await broadcastNotification(userId);
    }
  }

  return NextResponse.json(task);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const { prismaUser } = auth;

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: { select: { workspace_id: true, owner_id: true } } },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, task.project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    task.project.owner_id !== prismaUser.id &&
    task.assignee_id !== prismaUser.id &&
    !isWorkspaceAdminFor(auth, task.project.workspace_id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
export const GET = withErrorReporting("api:tasks/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:tasks/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:tasks/id:DELETE", DELETE_handler);
