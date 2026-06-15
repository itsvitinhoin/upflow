import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { startOfToday } from "@/lib/time-range";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string; group: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const space = await prisma.space.findUnique({
    where: { id: params.id },
    select: { id: true, workspace_id: true },
  });
  if (!space || !canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const { limit, cursor } = parsePagination(req, { defaultLimit: 25, maxLimit: 100 });
  const todayStart = startOfToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const projectScope: Prisma.ProjectWhereInput = {
    workspace_id: space.workspace_id,
    space_id: space.id,
  };
  const taskScope: Prisma.TaskWhereInput = { project: projectScope };
  const linkedRecordScope = {
    OR: [{ project: projectScope }, { task: { project: projectScope } }],
  };

  if (params.group === "urgent-actions") {
    const rows = await prisma.task.findMany({
      where: {
        ...taskScope,
        assignee_id: auth.prismaUser.id,
        status: { not: "done" },
        OR: [{ priority: "high" }, { due_date: { lt: tomorrowStart } }],
      },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ due_date: "asc" }, { priority: "desc" }, { created_at: "desc" }, { id: "asc" }],
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
        _count: { select: { comments: true, subtasks: true } },
      },
    });
    return NextResponse.json(buildPage(rows, limit));
  }

  if (params.group === "tasks") {
    const where: Prisma.TaskWhereInput = {
      ...taskScope,
      ...(status === "todo" || status === "in_progress" || status === "done" ? { status } : {}),
    };
    const rows = await prisma.task.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ position: "asc" }, { created_at: "desc" }, { id: "asc" }],
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { comments: true, subtasks: true } },
      },
    });
    return NextResponse.json(buildPage(rows, limit));
  }

  if (params.group === "meetings-today") {
    const rows = await prisma.calendarEvent.findMany({
      where: {
        workspace_id: space.workspace_id,
        starts_at: { gte: todayStart, lt: tomorrowStart },
        ...linkedRecordScope,
      },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ starts_at: "asc" }, { id: "asc" }],
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        attendees: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    return NextResponse.json(buildPage(rows, limit));
  }

  if (params.group === "time-today") {
    const rows = await prisma.timeEntry.findMany({
      where: {
        workspace_id: space.workspace_id,
        started_at: { gte: todayStart, lt: tomorrowStart },
        ...linkedRecordScope,
      },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ started_at: "desc" }, { id: "asc" }],
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });
    return NextResponse.json(buildPage(rows, limit));
  }

  if (params.group === "recent-activity") {
    const projectIds = await prisma.project.findMany({
      where: projectScope,
      select: { id: true },
    });
    const rows = await prisma.activityEvent.findMany({
      where: {
        workspace_id: space.workspace_id,
        project_id: { in: projectIds.map((project) => project.id) },
      },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      include: { actor: { select: { id: true, name: true, email: true, avatar_url: true } } },
    });
    return NextResponse.json(buildPage(rows, limit));
  }

  if (params.group === "projects-at-risk") {
    const rows = await prisma.project.findMany({
      where: {
        ...projectScope,
        status: "active",
        tasks: { some: { status: { not: "done" }, due_date: { lt: todayStart } } },
      },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ due_date: "asc" }, { created_at: "desc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
        tasks: {
          where: { status: { not: "done" }, due_date: { lt: todayStart } },
          take: 5,
          orderBy: [{ due_date: "asc" }, { id: "asc" }],
          select: { id: true, title: true, due_date: true, priority: true, status: true },
        },
      },
    });
    return NextResponse.json(buildPage(rows, limit));
  }

  return NextResponse.json({ error: "Unknown Space dashboard detail group" }, { status: 404 });
}

export const GET = withErrorReporting("api:spaces/id/dashboard/details/group:GET", GET_handler);
