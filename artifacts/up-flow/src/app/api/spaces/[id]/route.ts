import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  // Scope to the caller's active workspace — Space must belong to it.
  // Returning a flat 404 (rather than 403) keeps Spaces from other
  // workspaces invisible to the caller.
  const space = await prisma.space.findFirst({
    where: { id: params.id, workspace_id: auth.currentWorkspaceId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { projects: true } },
    },
  });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [folders, projects, members, taskCounts, overdueCount, recentTasks] =
    await Promise.all([
      prisma.folder.findMany({
        where: { space_id: space.id },
        orderBy: [{ position: "asc" }, { created_at: "asc" }],
      }),
      prisma.project.findMany({
        where: { space_id: space.id },
        orderBy: [{ created_at: "desc" }],
        include: {
          owner: { select: { id: true, name: true, email: true } },
          folder: { select: { id: true, name: true, icon: true } },
          _count: { select: { tasks: true } },
        },
      }),
      prisma.workspaceMember.findMany({
        where: { workspace_id: space.workspace_id },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar_url: true },
          },
        },
        orderBy: { created_at: "asc" },
      }),
      prisma.task.groupBy({
        by: ["status"],
        where: { project: { space_id: space.id } },
        _count: { _all: true },
      }),
      prisma.task.count({
        where: {
          project: { space_id: space.id },
          status: { not: "done" },
          due_date: { lt: new Date() },
        },
      }),
      prisma.task.findMany({
        where: { project: { space_id: space.id } },
        orderBy: [{ created_at: "desc" }],
        take: 8,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

  // Per-project task status breakdown (for progress bars).
  const projectTaskBreakdown = await prisma.task.groupBy({
    by: ["project_id", "status"],
    where: { project: { space_id: space.id } },
    _count: { _all: true },
  });
  const breakdownByProject = new Map<
    string,
    { todo: number; in_progress: number; done: number }
  >();
  for (const row of projectTaskBreakdown) {
    const cur =
      breakdownByProject.get(row.project_id) ?? {
        todo: 0,
        in_progress: 0,
        done: 0,
      };
    cur[row.status] = row._count._all;
    breakdownByProject.set(row.project_id, cur);
  }
  const projectsWithBreakdown = projects.map((p) => ({
    ...p,
    task_breakdown:
      breakdownByProject.get(p.id) ?? { todo: 0, in_progress: 0, done: 0 },
  }));

  const counts = { todo: 0, in_progress: 0, done: 0 };
  for (const c of taskCounts) counts[c.status] = c._count._all;
  const total_tasks = counts.todo + counts.in_progress + counts.done;

  return NextResponse.json({
    space,
    folders,
    projects: projectsWithBreakdown,
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatar_url: m.user.avatar_url,
      role: m.role,
    })),
    stats: {
      total_projects: projects.length,
      total_tasks,
      todo: counts.todo,
      in_progress: counts.in_progress,
      done: counts.done,
      overdue: overdueCount,
    },
    recent_tasks: recentTasks,
  });
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const space = await prisma.space.findUnique({ where: { id: params.id } });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Owner of the space OR an admin of the space's workspace can edit.
  if (space.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { name?: string; icon?: string | null; position?: number };
  let trimmedName: string | undefined;
  if (body.name !== undefined) {
    trimmedName = body.name.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
  }
  const updated = await prisma.space.update({
    where: { id: params.id },
    data: {
      ...(trimmedName !== undefined && { name: trimmedName }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.position !== undefined && { position: body.position }),
    },
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json(updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const space = await prisma.space.findUnique({ where: { id: params.id } });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (space.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.space.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
export const GET = withErrorReporting("api:spaces/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:spaces/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:spaces/id:DELETE", DELETE_handler);
