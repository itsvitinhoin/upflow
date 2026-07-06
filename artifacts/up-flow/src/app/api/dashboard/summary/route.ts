import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { startOfToday, startOfWeekMonday } from "@/lib/time-range";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { attachTaskOnboardingLink, loadTaskOnboardingLinkMap } from "@/lib/task-onboarding-links";

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
  const nextSevenDays = new Date(todayStart);
  nextSevenDays.setDate(todayStart.getDate() + 7);

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
    userTasks,
    projects,
    users,
    calendarEvents,
    activity,
    runningEntry,
    weekTimeEntries,
    workspaceOpenTaskRows,
    todayTimeEntries,
    recentProjectActivity,
    activeClientCount,
    companyRevenue,
    topClients,
    companiesForHealth,
    deliveryProjects,
    departments,
    spaceCount,
    projectCount,
    companyCountForSetup,
    activeWorkspaceMemberCount,
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
        marketing_b2b_onboarding_form: {
          select: { id: true, status: true, completed_at: true },
        },
        marketing_b2c_onboarding_form: {
          select: { id: true, status: true, completed_at: true },
        },
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
        project: {
          select: {
            id: true,
            name: true,
            due_date: true,
            space: { select: { id: true, name: true, icon: true } },
            company: { select: { id: true, name: true } },
          },
        },
        marketing_b2b_onboarding_form: {
          select: { id: true, status: true, completed_at: true },
        },
        marketing_b2c_onboarding_form: {
          select: { id: true, status: true, completed_at: true },
        },
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
    prisma.company.findMany({
      where: { workspace_id: auth.currentWorkspaceId, status: { not: "archived" } },
      take: 100,
      orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        contacts: { select: { id: true } },
        activity_events: {
          take: 1,
          orderBy: [{ created_at: "desc" }, { id: "asc" }],
          select: { created_at: true },
        },
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            due_date: true,
            owner: { select: { id: true, name: true, email: true } },
            tasks: {
              select: {
                id: true,
                status: true,
                due_date: true,
                assignee_id: true,
              },
            },
          },
        },
      },
    }),
    prisma.project.findMany({
      where: { workspace_id: auth.currentWorkspaceId, status: "active" },
      take: 30,
      orderBy: [{ due_date: "asc" }, { created_at: "desc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
        space: { select: { id: true, name: true, icon: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            due_date: true,
            assignee_id: true,
          },
        },
      },
    }),
    prisma.department.findMany({
      where: { workspace_id: auth.currentWorkspaceId },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      include: {
        members: {
          where: { status: "active" },
          select: { user_id: true },
        },
      },
    }),
    prisma.space.count({
      where: { workspace_id: auth.currentWorkspaceId },
    }),
    prisma.project.count({
      where: { workspace_id: auth.currentWorkspaceId },
    }),
    prisma.company.count({
      where: { workspace_id: auth.currentWorkspaceId },
    }),
    prisma.workspaceMember.count({
      where: { workspace_id: auth.currentWorkspaceId, status: "active" },
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


  const onboardingLinkByTaskId = await loadTaskOnboardingLinkMap([
    ...userTasks.map((task) => task.id),
    ...workspaceOpenTaskRows.map((task) => task.id),
  ]);
  const tasks = userTasks.map((task) =>
    attachTaskOnboardingLink(task, onboardingLinkByTaskId),
  );
  const workspaceOpenTasks = workspaceOpenTaskRows.map((task) =>
    attachTaskOnboardingLink(task, onboardingLinkByTaskId),
  );
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
  const clientHealthItems = companiesForHealth.map((company) => {
    const companyTasks = company.projects.flatMap((project) => project.tasks);
    const openTasks = companyTasks.filter((task) => task.status !== "done");
    const overdueTasks = openTasks.filter(
      (task) => task.due_date && task.due_date < todayStart,
    );
    const nextDeadline =
      [
        ...company.projects
          .map((project) => project.due_date)
          .filter((date): date is Date => Boolean(date)),
        ...openTasks
          .map((task) => task.due_date)
          .filter((date): date is Date => Boolean(date)),
      ].sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const lastActivityAt = company.activity_events[0]?.created_at ?? null;
    const noRecentActivity = !lastActivityAt || lastActivityAt < sevenDaysAgo;
    const missingPlan = !company.plan_name && !company.service_type;
    const reasons: string[] = [];

    if (company.projects.length === 0) reasons.push("No active client work");
    if (company.contacts.length === 0) reasons.push("No contacts");
    if (overdueTasks.length > 0) {
      reasons.push(`${overdueTasks.length} overdue deliverable${overdueTasks.length === 1 ? "" : "s"}`);
    }
    if (noRecentActivity) reasons.push("No activity in 7 days");
    if (company.contract_value == null && missingPlan) reasons.push("No contract value or plan");

    const health_status =
      company.projects.length === 0 &&
      company.contacts.length === 0 &&
      !lastActivityAt &&
      company.contract_value == null &&
      missingPlan
        ? "not_enough_data"
        : overdueTasks.length > 0
          ? "at_risk"
          : reasons.length > 0
            ? "attention_needed"
            : "healthy";

    return {
      company: {
        id: company.id,
        name: company.name,
        commercial_status: company.commercial_status,
        status: company.status,
        contract_value: company.contract_value,
        commission: company.commission,
        plan_name: company.plan_name,
        service_type: company.service_type,
        owner: company.owner,
      },
      health_status,
      reasons,
      open_tasks: openTasks.length,
      overdue_tasks: overdueTasks.length,
      active_projects: company.projects.length,
      contact_count: company.contacts.length,
      next_deadline: nextDeadline,
      last_activity_at: lastActivityAt,
    };
  });
  const clientHealthCounts = clientHealthItems.reduce(
    (acc, item) => {
      acc[item.health_status as keyof typeof acc] += 1;
      return acc;
    },
    { healthy: 0, attention_needed: 0, at_risk: 0, not_enough_data: 0 },
  );
  const clientRiskItems = clientHealthItems
    .filter((item) => item.health_status === "at_risk" || item.health_status === "attention_needed")
    .slice(0, 10);
  const deliveryOverview = deliveryProjects.map((project) => {
    const done = project.tasks.filter((task) => task.status === "done").length;
    const openTasks = project.tasks.filter((task) => task.status !== "done");
    const overdue = openTasks.filter((task) => task.due_date && task.due_date < todayStart).length;
    const nextDeadline =
      [
        project.due_date,
        ...openTasks.map((task) => task.due_date),
      ].filter((date): date is Date => Boolean(date)).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const state =
      overdue > 0
        ? "at_risk"
        : nextDeadline && nextDeadline < nextSevenDays
          ? "attention_needed"
          : project.tasks.length === 0
            ? "not_enough_data"
            : "on_track";

    return {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        due_date: project.due_date,
        owner: project.owner,
        company: project.company,
        space: project.space,
      },
      progress: project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0,
      open_tasks: openTasks.length,
      overdue_tasks: overdue,
      next_deadline: nextDeadline,
      state,
    };
  });
  const creativeKeywords = [
    "creative",
    "design",
    "content",
    "reel",
    "video",
    "asset",
    "copy",
    "landing",
    "approval",
    "revision",
    "brief",
  ];
  const creativeQueueTasks = workspaceOpenTasks.filter((task) => {
    const haystack = [
      task.title,
      task.description,
      task.project?.name,
      task.project?.space?.name,
    ].filter(Boolean).join(" ").toLowerCase();
    return creativeKeywords.some((keyword) => haystack.includes(keyword));
  });
  const creativeQueue = {
    source_note:
      "Uses real open tasks from creative, production, marketing, approval, and content-related spaces or task text. Approval-specific fields are not modeled yet.",
    items: creativeQueueTasks.slice(0, 12).map((task) => {
      const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
      const stage =
        haystack.includes("revision")
          ? "revision_requested"
          : haystack.includes("approval") || haystack.includes("review")
            ? "waiting_for_approval"
            : task.status === "in_progress"
              ? "in_production"
              : haystack.includes("brief")
                ? "waiting_for_briefing"
                : "ready_to_start";
      return {
        task,
        stage,
      };
    }),
    counts: creativeQueueTasks.reduce(
      (acc, task) => {
        const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
        const stage =
          haystack.includes("revision")
            ? "revision_requested"
            : haystack.includes("approval") || haystack.includes("review")
              ? "waiting_for_approval"
              : task.status === "in_progress"
                ? "in_production"
                : haystack.includes("brief")
                  ? "waiting_for_briefing"
                  : "ready_to_start";
        acc[stage as keyof typeof acc] += 1;
        return acc;
      },
      {
        waiting_for_briefing: 0,
        ready_to_start: 0,
        in_production: 0,
        waiting_for_approval: 0,
        revision_requested: 0,
      },
    ),
  };
  const departmentByUser = new Map<string, string | null>();
  for (const member of flattenedUsers) {
    departmentByUser.set(member.id, member.department_id ?? null);
  }
  const departmentWorkload = [
    ...departments.map((department) => {
      const userIds = new Set(department.members.map((member) => member.user_id));
      const assignedTasks = workspaceOpenTasks.filter(
        (task) => task.assignee_id && userIds.has(task.assignee_id),
      );
      const overdueTasks = assignedTasks.filter(
        (task) => task.due_date && new Date(task.due_date) < todayStart,
      );
      const upcomingTasks = assignedTasks.filter(
        (task) =>
          task.due_date &&
          new Date(task.due_date) >= todayStart &&
          new Date(task.due_date) < nextSevenDays,
      );
      return {
        department: { id: department.id, name: department.name, color: department.color },
        active_tasks: assignedTasks.length,
        overdue_tasks: overdueTasks.length,
        upcoming_tasks: upcomingTasks.length,
        assigned_members: userIds.size,
      };
    }),
    {
      department: { id: "unassigned", name: "Unassigned", color: "slate" },
      active_tasks: workspaceOpenTasks.filter((task) => !task.assignee_id || !departmentByUser.get(task.assignee_id)).length,
      overdue_tasks: workspaceOpenTasks.filter(
        (task) =>
          (!task.assignee_id || !departmentByUser.get(task.assignee_id)) &&
          task.due_date &&
          new Date(task.due_date) < todayStart,
      ).length,
      upcoming_tasks: workspaceOpenTasks.filter(
        (task) =>
          (!task.assignee_id || !departmentByUser.get(task.assignee_id)) &&
          task.due_date &&
          new Date(task.due_date) >= todayStart &&
          new Date(task.due_date) < nextSevenDays,
      ).length,
      assigned_members: flattenedUsers.filter((member) => !member.department_id).length,
    },
  ];
  const overdueDeliverables = workspaceOpenTasks.filter(
    (task) => task.due_date && new Date(task.due_date) < todayStart,
  );
  const unassignedDeliverables = workspaceOpenTasks.filter((task) => !task.assignee_id);
  const projectsWithoutDeadlines = deliveryProjects.filter((project) => !project.due_date);
  const busiestMember = workload
    .filter((member) => member.open_tasks > 0)
    .sort((a, b) => b.open_tasks - a.open_tasks)[0];
  const workloadConcentration =
    busiestMember && workspaceOpenTasks.length > 0 && busiestMember.open_tasks / workspaceOpenTasks.length >= 0.5
      ? 1
      : 0;
  const agencyRiskSignals = [
    {
      key: "overdue_deliverables",
      label: "Overdue deliverables",
      count: overdueDeliverables.length,
      trace: "Open tasks with due dates before today",
    },
    {
      key: "unassigned_deliverables",
      label: "Tasks without owners",
      count: unassignedDeliverables.length,
      trace: "Open tasks without an assignee",
    },
    {
      key: "projects_without_deadlines",
      label: "Projects without deadlines",
      count: projectsWithoutDeadlines.length,
      trace: "Active projects missing a project due date",
    },
    {
      key: "clients_needing_attention",
      label: "Clients needing attention",
      count: clientRiskItems.length,
      trace: "Clients with overdue work, missing setup, or no recent activity",
    },
    {
      key: "workload_concentration",
      label: "Workload concentration",
      count: workloadConcentration,
      trace: busiestMember
        ? `${busiestMember.user.name} owns ${busiestMember.open_tasks} of ${workspaceOpenTasks.length} open tasks`
        : "No assigned open tasks",
    },
  ];

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
        rules: ["overdue open tasks", "no owner", "no activity in 7 days"],
      },
      client_risk: {
        items: clientRiskItems.map((item) => ({
          company: item.company,
          reasons: item.reasons,
          open_tasks: item.open_tasks,
          overdue_tasks: item.overdue_tasks,
        })),
        count: clientRiskItems.length,
      },
      client_health: {
        items: clientHealthItems.slice(0, 12),
        counts: clientHealthCounts,
      },
      delivery_overview: {
        items: deliveryOverview.slice(0, 12),
      },
      creative_queue: creativeQueue,
      department_workload: {
        items: departmentWorkload,
      },
      agency_risk_signals: {
        items: agencyRiskSignals,
      },
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
      workspace_setup: {
        spaces: spaceCount,
        projects: projectCount,
        clients: companyCountForSetup,
        members: activeWorkspaceMemberCount,
        role: auth.currentRole,
      },
    },
  });
}

export const GET = withErrorReporting(
  "api:dashboard/summary:GET",
  GET_handler,
);
