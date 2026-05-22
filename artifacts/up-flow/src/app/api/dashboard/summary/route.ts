import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { startOfToday, startOfWeekMonday } from "@/lib/time-range";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({
      tasks: { items: [], nextCursor: null },
      projects: { items: [], nextCursor: null },
      users: { items: [], nextCursor: null },
      calendar_events: { items: [], nextCursor: null },
      activity: { items: [], nextCursor: null },
      time: { running: null, week_entries: [] },
    });
  }

  const superAdmin = isSuperAdmin(auth);
  const { searchParams } = new URL(req.url);
  const { limit } = parsePagination(req, { defaultLimit: 80, maxLimit: 150 });
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const todayStart = startOfToday();
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const weekStart = startOfWeekMonday();
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(todayStart.getDate() - 7);

  const userWhere: Prisma.UserWhereInput | undefined = superAdmin
    ? undefined
    : {
        memberships: {
          some: {
            workspace_id: { in: auth.memberships.map((m) => m.workspace_id) },
          },
        },
      };

  const [
    tasks,
    projects,
    users,
    calendarEvents,
    activity,
    runningEntry,
    weekTimeEntries,
    workspaceOpenTasks,
    todayTimeEntries,
    recentProjectActivity,
    activeClientCount,
    companyRevenue,
    topClients,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignee_id: auth.prismaUser.id,
        project: { workspace_id: auth.currentWorkspaceId },
        ...(status === "todo" || status === "in_progress" || status === "done"
          ? { status }
          : {}),
        ...(q && { title: { contains: q, mode: "insensitive" as const } }),
      },
      take: limit + 1,
      orderBy: [{ position: "asc" }, { created_at: "desc" }, { id: "asc" }],
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        custom_field_values: { select: { definition_id: true, value: true } },
        _count: { select: { comments: true, subtasks: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        ...(q && { name: { contains: q, mode: "insensitive" as const } }),
      },
      take: limit + 1,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        space: { select: { id: true, name: true, icon: true } },
        folder: { select: { id: true, name: true, icon: true } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.user.findMany({
      where: userWhere,
      take: 100,
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
            : {
                workspace_id: {
                  in: auth.memberships.map((m) => m.workspace_id),
                },
              },
          select: {
            workspace_id: true,
            role: true,
            status: true,
            department_id: true,
          },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        starts_at: { gte: todayStart, lt: tomorrowStart },
      },
      take: 10,
      orderBy: [{ starts_at: "asc" }, { id: "asc" }],
      include: {
        attendees: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.activityEvent.findMany({
      where: { workspace_id: auth.currentWorkspaceId },
      take: 10,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      include: {
        actor: { select: { id: true, name: true, email: true, avatar_url: true } },
      },
    }),
    prisma.timeEntry.findFirst({
      where: {
        workspace_id: auth.currentWorkspaceId,
        user_id: auth.prismaUser.id,
        status: "running",
      },
      orderBy: { started_at: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        user_id: auth.prismaUser.id,
        started_at: { gte: weekStart, lt: nextWeekStart },
      },
      take: 100,
      orderBy: [{ started_at: "desc" }, { id: "asc" }],
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        project: { workspace_id: auth.currentWorkspaceId },
        status: { not: "done" },
      },
      take: 150,
      orderBy: [{ due_date: "asc" }, { priority: "desc" }, { created_at: "desc" }],
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { comments: true, subtasks: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        started_at: { gte: todayStart, lt: tomorrowStart },
      },
      take: 150,
      orderBy: [{ started_at: "desc" }, { id: "asc" }],
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.activityEvent.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        project_id: { not: null },
        created_at: { gte: sevenDaysAgo },
      },
      take: 150,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      select: { project_id: true },
    }),
    prisma.company.count({
      where: { workspace_id: auth.currentWorkspaceId, status: { not: "archived" } },
    }),
    prisma.company.aggregate({
      where: { workspace_id: auth.currentWorkspaceId },
      _sum: { contract_value: true, commission: true },
      _count: { id: true, contract_value: true },
    }),
    prisma.company.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        contract_value: { not: null },
      },
      take: 5,
      orderBy: [{ contract_value: "desc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        contract_value: true,
        commission: true,
      },
    }),
  ]);

  const flattenedUsers = users.map((u) => {
    const activeMembership = u.memberships.find(
      (m) => m.workspace_id === auth.currentWorkspaceId,
    );
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

  const urgentActions = workspaceOpenTasks.filter((task) => {
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
    const assignedOpenTasks = workspaceOpenTasks.filter((task) => task.assignee_id === member.id);
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
  for (const task of workspaceOpenTasks) {
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
    .slice(0, 10);

  const todayEntriesForMe = todayTimeEntries.filter((entry) => entry.user_id === auth.prismaUser.id);
  const totalSecondsToday = todayEntriesForMe.reduce((sum, entry) => {
    if (entry.status === "running") {
      return sum + Math.max(0, Math.floor((Date.now() - entry.started_at.getTime()) / 1000));
    }
    return sum + entry.duration_seconds;
  }, 0);
  const companyCount = companyRevenue._count.id;
  const clientsWithContractValue = companyRevenue._count.contract_value;

  return NextResponse.json({
    tasks: buildPage(tasks, limit),
    projects: buildPage(projects, limit),
    users: buildPage(flattenedUsers, 100),
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
        rules: [
          "overdue open tasks",
          "no owner",
          "no activity in 7 days",
          "blocked tasks",
          "no due-date movement",
        ],
      },
      client_risk: { items: [], count: 0 },
      revenue_snapshot: {
        active_clients: activeClientCount,
        total_contract_value: companyRevenue._sum.contract_value ?? 0,
        total_commission: companyRevenue._sum.commission ?? 0,
        clients_without_contract_value: companyCount - clientsWithContractValue,
        top_clients: topClients,
      },
      quick_create: {
        items: ["task", "meeting", "company", "project", "note"],
      },
    },
  });
}

export const GET = withErrorReporting(
  "api:dashboard/summary:GET",
  GET_handler,
);
