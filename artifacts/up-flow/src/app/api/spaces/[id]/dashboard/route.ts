import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { getDepartmentSpacePreset } from "@/lib/department-spaces";
import { buildPage, parsePagination } from "@/lib/pagination";
import { startOfToday, startOfWeekMonday } from "@/lib/time-range";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const space = await prisma.space.findFirst({
    where: { id: params.id, workspace_id: auth.currentWorkspaceId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { projects: true } },
    },
  });
  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const departmentPreset = getDepartmentSpacePreset(space.name);

  const superAdmin = isSuperAdmin(auth);
  const { limit } = parsePagination(req, { defaultLimit: 200, maxLimit: 500 });
  const todayStart = startOfToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const weekStart = startOfWeekMonday();
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(todayStart.getDate() - 7);

  const spaceProjectWhere: Prisma.ProjectWhereInput = {
    workspace_id: space.workspace_id,
    space_id: space.id,
  };
  const taskProjectScope: Prisma.TaskWhereInput = {
    project: spaceProjectWhere,
  };

  const [
    projects,
    tasks,
    openTasks,
    users,
    projectIds,
    taskIds,
  ] = await Promise.all([
    prisma.project.findMany({
      where: spaceProjectWhere,
      take: limit + 1,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        space: { select: { id: true, name: true, icon: true } },
        folder: { select: { id: true, name: true, icon: true } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.task.findMany({
      where: taskProjectScope,
      take: limit + 1,
      orderBy: [{ position: "asc" }, { created_at: "desc" }, { id: "asc" }],
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        custom_field_values: { select: { definition_id: true, value: true } },
        _count: { select: { comments: true, subtasks: true } },
      },
    }),
    prisma.task.findMany({
      where: { ...taskProjectScope, status: { not: "done" } },
      take: 500,
      orderBy: [{ due_date: "asc" }, { priority: "desc" }, { created_at: "desc" }],
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { comments: true, subtasks: true } },
      },
    }),
    prisma.user.findMany({
      where: superAdmin
        ? undefined
        : {
            memberships: {
              some: { workspace_id: { in: auth.memberships.map((m) => m.workspace_id) } },
            },
          },
      take: limit + 1,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        avatar_url: true,
        role: true,
        created_at: true,
        _count: { select: { tasks: true, projects: true } },
        memberships: {
          where: superAdmin
            ? undefined
            : { workspace_id: { in: auth.memberships.map((m) => m.workspace_id) } },
          select: {
            workspace_id: true,
            role: true,
            status: true,
            department_id: true,
          },
        },
      },
    }),
    prisma.project.findMany({
      where: spaceProjectWhere,
      select: { id: true },
    }),
    prisma.task.findMany({
      where: taskProjectScope,
      select: { id: true },
      take: 1000,
    }),
  ]);

  const projectIdList = projectIds.map((project) => project.id);
  const taskIdList = taskIds.map((task) => task.id);
  const scopedRecordWhere = {
    OR: [
      ...(projectIdList.length > 0 ? [{ project_id: { in: projectIdList } }] : []),
      ...(taskIdList.length > 0 ? [{ task_id: { in: taskIdList } }] : []),
    ],
  };
  const hasScopedRecords = scopedRecordWhere.OR.length > 0;

  const [
    calendarEvents,
    activity,
    runningEntry,
    weekTimeEntries,
    todayTimeEntries,
    recentProjectActivity,
  ] = await Promise.all([
    hasScopedRecords
      ? prisma.calendarEvent.findMany({
          where: {
            workspace_id: space.workspace_id,
            starts_at: { gte: todayStart, lt: tomorrowStart },
            ...scopedRecordWhere,
          },
          take: 20,
          orderBy: [{ starts_at: "asc" }, { id: "asc" }],
          include: {
            attendees: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        })
      : Promise.resolve([]),
    hasScopedRecords
      ? prisma.activityEvent.findMany({
          where: {
            workspace_id: space.workspace_id,
            ...scopedRecordWhere,
          },
          take: 20,
          orderBy: [{ created_at: "desc" }, { id: "asc" }],
          include: {
            actor: { select: { id: true, name: true, email: true, avatar_url: true } },
          },
        })
      : Promise.resolve([]),
    hasScopedRecords
      ? prisma.timeEntry.findFirst({
          where: {
            workspace_id: space.workspace_id,
            user_id: auth.prismaUser.id,
            status: "running",
            ...scopedRecordWhere,
          },
          orderBy: { started_at: "desc" },
          include: {
            project: { select: { id: true, name: true } },
            task: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve(null),
    hasScopedRecords
      ? prisma.timeEntry.findMany({
          where: {
            workspace_id: space.workspace_id,
            user_id: auth.prismaUser.id,
            started_at: { gte: weekStart, lt: nextWeekStart },
            ...scopedRecordWhere,
          },
          orderBy: [{ started_at: "desc" }, { id: "asc" }],
          include: {
            project: { select: { id: true, name: true } },
            task: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    hasScopedRecords
      ? prisma.timeEntry.findMany({
          where: {
            workspace_id: space.workspace_id,
            started_at: { gte: todayStart, lt: tomorrowStart },
            ...scopedRecordWhere,
          },
          take: 500,
          orderBy: [{ started_at: "desc" }, { id: "asc" }],
          include: {
            user: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true } },
            task: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
    projectIdList.length > 0
      ? prisma.activityEvent.findMany({
          where: {
            workspace_id: space.workspace_id,
            project_id: { in: projectIdList },
            created_at: { gte: sevenDaysAgo },
          },
          take: 500,
          orderBy: [{ created_at: "desc" }, { id: "asc" }],
          select: { project_id: true },
        })
      : Promise.resolve([]),
  ]);

  const flattenedUsers = users.map((u) => {
    const activeMembership = u.memberships.find((m) => m.workspace_id === space.workspace_id);
    const { memberships: _memberships, ...rest } = u;
    void _memberships;
    return {
      ...rest,
      workspace_role: activeMembership?.role ?? null,
      workspace_status: activeMembership?.status ?? null,
      department_id: activeMembership?.department_id ?? null,
      workspaces: u.memberships.map((m) => ({
        workspace_id: m.workspace_id,
        role: m.role,
        status: m.status,
        department_id: m.department_id,
      })),
    };
  });

  const urgentActions = openTasks.filter((task) => {
    const due = task.due_date ? new Date(task.due_date) : null;
    return (
      task.assignee_id === auth.prismaUser.id &&
      (task.priority === "high" || (due !== null && due < tomorrowStart))
    );
  });

  const todayTimeByUser = new Map<string, number>();
  for (const entry of todayTimeEntries) {
    const duration =
      entry.status === "running"
        ? Math.max(0, Math.floor((Date.now() - entry.started_at.getTime()) / 1000))
        : entry.duration_seconds;
    todayTimeByUser.set(entry.user_id, (todayTimeByUser.get(entry.user_id) ?? 0) + duration);
  }

  const workload = flattenedUsers.map((member) => {
    const assignedOpenTasks = openTasks.filter((task) => task.assignee_id === member.id);
    const overdueTasks = assignedOpenTasks.filter(
      (task) => task.due_date && new Date(task.due_date) < todayStart,
    );
    const dueTodayTasks = assignedOpenTasks.filter(
      (task) =>
        task.due_date &&
        new Date(task.due_date) >= todayStart &&
        new Date(task.due_date) < tomorrowStart,
    );
    const trackedSecondsToday = todayTimeByUser.get(member.id) ?? 0;
    return {
      user: member,
      open_tasks: assignedOpenTasks.length,
      overdue_tasks: overdueTasks.length,
      due_today_tasks: dueTodayTasks.length,
      tracked_seconds_today: trackedSecondsToday,
      tasks: assignedOpenTasks.slice(0, 8),
      state:
        overdueTasks.length > 0
          ? "late"
          : assignedOpenTasks.length >= 8
            ? "overloaded"
            : assignedOpenTasks.length === 0 && trackedSecondsToday === 0
              ? "idle"
              : "active",
    };
  });

  const recentProjectIds = new Set(
    recentProjectActivity
      .map((event) => event.project_id)
      .filter((id): id is string => Boolean(id)),
  );
  const overdueByProject = new Map<string, number>();
  for (const task of openTasks) {
    if (task.due_date && new Date(task.due_date) < todayStart) {
      overdueByProject.set(task.project_id, (overdueByProject.get(task.project_id) ?? 0) + 1);
    }
  }
  const projectsAtRisk = projects
    .map((project) => {
      const reasons: string[] = [];
      const overdue = overdueByProject.get(project.id) ?? 0;
      if (overdue > 0) reasons.push(`${overdue} overdue open task${overdue === 1 ? "" : "s"}`);
      if (!project.owner_id) reasons.push("No owner");
      if (!recentProjectIds.has(project.id)) reasons.push("No activity in 7 days");
      return { project, reasons };
    })
    .filter((item) => item.reasons.length > 0)
    .slice(0, 20);

  const todayEntriesForMe = todayTimeEntries.filter((entry) => entry.user_id === auth.prismaUser.id);
  const totalSecondsToday = todayEntriesForMe.reduce((sum, entry) => {
    if (entry.status === "running") {
      return sum + Math.max(0, Math.floor((Date.now() - entry.started_at.getTime()) / 1000));
    }
    return sum + entry.duration_seconds;
  }, 0);

  return NextResponse.json({
    space,
    department_preset: departmentPreset,
    tasks: buildPage(tasks, limit),
    projects: buildPage(projects, limit),
    users: buildPage(flattenedUsers, limit),
    calendar_events: { items: calendarEvents, nextCursor: null },
    activity: { items: activity, nextCursor: null },
    time: {
      running: runningEntry,
      week_entries: weekTimeEntries,
    },
    command_center: {
      urgent_actions: { items: urgentActions, count: urgentActions.length },
      team_workload: { items: workload, count: workload.length },
      time_today: {
        total_seconds: totalSecondsToday,
        running: runningEntry,
        entries: todayEntriesForMe,
      },
      meetings_today: { items: calendarEvents, count: calendarEvents.length },
      recent_activity: { items: activity, count: activity.length },
      projects_at_risk: {
        items: projectsAtRisk,
        count: projectsAtRisk.length,
        rules: ["overdue open tasks", "no owner", "no activity in 7 days"],
      },
      quick_create: {
        items: ["task", "meeting", "project"],
      },
    },
  });
}

export const GET = withErrorReporting("api:spaces/id/dashboard:GET", GET_handler);
