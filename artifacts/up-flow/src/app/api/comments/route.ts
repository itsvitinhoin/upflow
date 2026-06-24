import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { broadcastNotification } from "@/lib/supabase-server";
import { buildPage, parsePagination } from "@/lib/pagination";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

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

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

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
  if (!isWorkspaceAdminFor(auth, taskRecord.project.workspace_id)) {
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

  const task = await prisma.task.findUnique({
    where: { id: task_id },
    select: {
      id: true,
      title: true,
      assignee_id: true,
      project: { select: { workspace_id: true } },
    },
  });

  // Parse @mentions from the comment body. We support two formats so the UI
  // can evolve without backend changes:
  //   - Markdown-style `@[Name](userId)` — unambiguous, preferred.
  //   - Bare `@email@domain.tld` — convenient when typing.
  const mentionedUserIds = new Set<string>();
  if (task) {
    const markdownRe = /@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)/g;
    const emailRe = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    const idCandidates = new Set<string>();
    const emailCandidates = new Set<string>();
    for (const m of commentBody.matchAll(markdownRe)) idCandidates.add(m[1]);
    for (const m of commentBody.matchAll(emailRe)) emailCandidates.add(m[1].toLowerCase());

    if (idCandidates.size > 0 || emailCandidates.size > 0) {
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspace_id: task.project.workspace_id,
          OR: [
            ...(idCandidates.size > 0 ? [{ user_id: { in: [...idCandidates] } }] : []),
            ...(emailCandidates.size > 0
              ? [{ user: { email: { in: [...emailCandidates] } } }]
              : []),
          ],
        },
        select: { user_id: true },
      });
      for (const m of members) {
        if (m.user_id !== userId) mentionedUserIds.add(m.user_id);
      }
    }
  }

  const excerpt = commentBody.trim().slice(0, 140);

  // De-dupe assignee: a mentioned assignee should get exactly one
  // `mentioned` notification for this comment, not also a `commented` one.
  const assigneeId = task?.assignee_id ?? null;
  const assigneeMentioned = assigneeId ? mentionedUserIds.has(assigneeId) : false;

  if (assigneeId && assigneeId !== userId && !assigneeMentioned) {
    await prisma.notification
      .create({ data: { type: "commented", user_id: assigneeId, task_id } })
      .catch((err) => logError("api:comments:notify", err, { task_id }));
    await broadcastNotification(assigneeId);
  }

  for (const recipientId of mentionedUserIds) {
    await prisma.notification
      .create({
        data: {
          type: "mentioned",
          user_id: recipientId,
          task_id,
          data: {
            comment_id: comment.id,
            comment_excerpt: excerpt,
            actor_id: userId,
            actor_name: auth.prismaUser.name,
            task_title: task?.title ?? null,
          },
        },
      })
      .catch((err) =>
        logError("api:comments:mention-notify", err, { task_id, user_id: recipientId }),
      );
    await broadcastNotification(recipientId);
  }

  return NextResponse.json(comment, { status: 201 });
}
export const GET = withErrorReporting("api:comments:GET", GET_handler);
export const POST = withErrorReporting("api:comments:POST", POST_handler);
