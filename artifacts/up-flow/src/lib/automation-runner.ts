import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity";

export const AUTOMATION_RUNNER_TRIGGERS = [
  "task_overdue",
  "task_done",
  "project_inactive",
  "client_created",
  "meeting_created",
  "no_client_activity_7_days",
  "client_at_risk",
  "weekly_friday_client_health_report",
] as const;

export interface AutomationRunResult {
  rule_id: string;
  rule_name: string;
  trigger: string;
  action_type: string;
  matched: number;
  executed: number;
  skipped: number;
  notes: string[];
}

type AutomationAction = {
  type?: string;
  config?: Record<string, unknown>;
};

interface AutomationTarget {
  kind: "task" | "project" | "company" | "meeting" | "workspace";
  id: string;
  label: string;
  projectId?: string | null;
  taskId?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
}

export async function runAutomationRules(input: {
  workspaceId: string;
  actorId: string;
  dryRun?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dryRun = input.dryRun ?? false;
  const rules = await prisma.automationRule.findMany({
    where: { workspace_id: input.workspaceId, active: true },
    orderBy: [{ updated_at: "desc" }, { id: "asc" }],
  });
  const admins = await prisma.workspaceMember.findMany({
    where: {
      workspace_id: input.workspaceId,
      status: "active",
      role: { in: ["owner", "admin"] },
    },
    select: { user_id: true },
  });
  const adminIds = admins.map((member) => member.user_id);

  const results: AutomationRunResult[] = [];
  for (const rule of rules) {
    const action = parseAction(rule.action);
    const targets = await findTargetsForRule(input.workspaceId, rule.trigger, now);
    let executed = 0;
    let skipped = 0;
    const notes: string[] = [];

    for (const target of targets) {
      const outcome = dryRun
        ? { ok: true, note: `Would run ${action.type ?? "unknown_action"} for ${target.kind}:${target.id}` }
        : await executeAction({
            workspaceId: input.workspaceId,
            actorId: input.actorId,
            adminIds,
            ruleId: rule.id,
            ruleName: rule.name,
            trigger: rule.trigger,
            action,
            target,
            now,
          });
      if (outcome.ok) executed += 1;
      else skipped += 1;
      if (outcome.note) notes.push(outcome.note);
    }

    results.push({
      rule_id: rule.id,
      rule_name: rule.name,
      trigger: rule.trigger,
      action_type: action.type ?? "unknown_action",
      matched: targets.length,
      executed,
      skipped,
      notes: notes.slice(0, 10),
    });
  }

  if (!dryRun) {
    await recordActivity({
      workspace_id: input.workspaceId,
      actor_id: input.actorId,
      type: "automation_runner_executed",
      entity_type: "automation_run",
      metadata: {
        rule_count: rules.length,
        executed: results.reduce((sum, result) => sum + result.executed, 0),
        skipped: results.reduce((sum, result) => sum + result.skipped, 0),
      },
    });
  }

  return {
    dryRun,
    ran_at: now.toISOString(),
    rule_count: rules.length,
    results,
  };
}

function parseAction(value: Prisma.JsonValue): AutomationAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const config = record.config && typeof record.config === "object" && !Array.isArray(record.config)
    ? (record.config as Record<string, unknown>)
    : {};
  return {
    type: typeof record.type === "string" ? record.type : undefined,
    config,
  };
}

async function findTargetsForRule(workspaceId: string, trigger: string, now: Date): Promise<AutomationTarget[]> {
  const batchLimit = 25;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  if (trigger === "task_overdue") {
    const tasks = await prisma.task.findMany({
      where: { status: { not: "done" }, due_date: { lt: today }, project: { workspace_id: workspaceId } },
      take: batchLimit,
      orderBy: [{ due_date: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        project_id: true,
        company_id: true,
        assignee_id: true,
        project: { select: { owner_id: true } },
      },
    });
    return tasks.map((task) => ({
      kind: "task",
      id: task.id,
      label: task.title,
      projectId: task.project_id,
      taskId: task.id,
      companyId: task.company_id,
      ownerId: task.assignee_id ?? task.project.owner_id,
    }));
  }

  if (trigger === "task_done") {
    const events = await prisma.activityEvent.findMany({
      where: { workspace_id: workspaceId, type: "task_status_changed", created_at: { gte: oneDayAgo } },
      take: batchLimit,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
    });
    return events
      .filter((event) => {
        const metadata = event.metadata as Record<string, unknown> | null;
        return metadata?.new_status === "done";
      })
      .map((event) => ({
        kind: "task",
        id: event.task_id ?? event.id,
        label: String((event.metadata as Record<string, unknown> | null)?.title ?? "Completed task"),
        projectId: event.project_id,
        taskId: event.task_id,
        companyId: event.company_id,
      }));
  }

  if (trigger === "project_inactive") {
    const recent = await prisma.activityEvent.findMany({
      where: { workspace_id: workspaceId, project_id: { not: null }, created_at: { gte: sevenDaysAgo } },
      select: { project_id: true },
      take: 500,
    });
    const recentProjectIds = [...new Set(recent.map((event) => event.project_id).filter(Boolean) as string[])];
    const projects = await prisma.project.findMany({
      where: { workspace_id: workspaceId, status: "active", id: { notIn: recentProjectIds } },
      take: batchLimit,
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      select: { id: true, name: true, owner_id: true, company_id: true },
    });
    return projects.map((project) => ({
      kind: "project",
      id: project.id,
      label: project.name,
      projectId: project.id,
      companyId: project.company_id,
      ownerId: project.owner_id,
    }));
  }

  if (trigger === "client_created") {
    const companies = await prisma.company.findMany({
      where: { workspace_id: workspaceId, created_at: { gte: oneDayAgo } },
      take: batchLimit,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      select: { id: true, name: true, owner_id: true, projects: { select: { id: true }, take: 1 } },
    });
    return companies.map((company) => ({
      kind: "company",
      id: company.id,
      label: company.name,
      companyId: company.id,
      projectId: company.projects[0]?.id ?? null,
      ownerId: company.owner_id,
    }));
  }

  if (trigger === "meeting_created") {
    const meetings = await prisma.calendarEvent.findMany({
      where: { workspace_id: workspaceId, created_at: { gte: oneDayAgo } },
      take: batchLimit,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      select: { id: true, title: true, project_id: true, task_id: true, company_id: true, created_by: true },
    });
    return meetings.map((meeting) => ({
      kind: "meeting",
      id: meeting.id,
      label: meeting.title,
      projectId: meeting.project_id,
      taskId: meeting.task_id,
      companyId: meeting.company_id,
      ownerId: meeting.created_by,
    }));
  }

  if (trigger === "no_client_activity_7_days" || trigger === "client_at_risk") {
    const companies = await prisma.company.findMany({
      where: { workspace_id: workspaceId },
      take: 100,
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        owner_id: true,
        contract_value: true,
        plan_name: true,
        service_type: true,
        contacts: { select: { id: true } },
        projects: { select: { id: true }, take: 1 },
        tasks: { select: { id: true, status: true, due_date: true } },
        activity_events: { select: { created_at: true }, orderBy: [{ created_at: "desc" }, { id: "asc" }], take: 1 },
      },
    });
    return companies
      .filter((company) => {
        const latest = company.activity_events[0]?.created_at ?? null;
        const stale = !latest || latest < sevenDaysAgo;
        if (trigger === "no_client_activity_7_days") return stale;
        const overdue = company.tasks.some((task) => task.status !== "done" && task.due_date && task.due_date < today);
        return (
          overdue ||
          stale ||
          company.contacts.length === 0 ||
          company.projects.length === 0 ||
          company.contract_value == null ||
          (!company.plan_name && !company.service_type)
        );
      })
      .slice(0, batchLimit)
      .map((company) => ({
        kind: "company",
        id: company.id,
        label: company.name,
        companyId: company.id,
        projectId: company.projects[0]?.id ?? null,
        ownerId: company.owner_id,
      }));
  }

  if (trigger === "weekly_friday_client_health_report") {
    if (now.getDay() !== 5) return [];
    return [{ kind: "workspace", id: workspaceId, label: "Weekly client health report" }];
  }

  return [];
}

async function executeAction(input: {
  workspaceId: string;
  actorId: string;
  adminIds: string[];
  ruleId: string;
  ruleName: string;
  trigger: string;
  action: AutomationAction;
  target: AutomationTarget;
  now: Date;
}): Promise<{ ok: boolean; note?: string }> {
  const actionType = input.action.type;
  if (!actionType) return { ok: false, note: "Missing action type" };

  if (actionType === "notify_admins") {
    await createAutomationNotifications(input.adminIds, input);
    return { ok: true };
  }

  if (actionType === "notify_user") {
    const userId = getString(input.action.config, "user_id");
    if (!userId) return { ok: false, note: "notify_user requires config.user_id" };
    await createAutomationNotifications([userId], input);
    return { ok: true };
  }

  if (actionType === "notify_project_owner") {
    if (!input.target.ownerId) return { ok: false, note: "Target has no owner to notify" };
    await createAutomationNotifications([input.target.ownerId], input);
    return { ok: true };
  }

  if (actionType === "create_task" || actionType === "create_follow_up_task") {
    const projectId = getString(input.action.config, "project_id") ?? input.target.projectId;
    if (!projectId) return { ok: false, note: "No project available for task creation" };
    const title =
      getString(input.action.config, "title") ??
      (actionType === "create_follow_up_task"
        ? `Follow up with ${input.target.label}`
        : `Automation task: ${input.target.label}`);
    const task = await prisma.task.create({
      data: {
        title,
        project_id: projectId,
        company_id: input.target.companyId ?? undefined,
        assignee_id: getString(input.action.config, "assignee_id") ?? input.target.ownerId ?? undefined,
        status: "todo",
        priority: getPriority(input.action.config, "priority") ?? "medium",
        description: `Created by automation rule "${input.ruleName}" from ${input.trigger}.`,
      },
    });
    await recordActivity({
      workspace_id: input.workspaceId,
      actor_id: input.actorId,
      type: "automation_task_created",
      entity_type: "task",
      entity_id: task.id,
      project_id: task.project_id,
      task_id: task.id,
      company_id: task.company_id,
      metadata: { rule_id: input.ruleId, rule_name: input.ruleName, trigger: input.trigger },
    });
    return { ok: true };
  }

  if (actionType === "generate_client_health_report") {
    const clientsAtRisk = await prisma.company.count({
      where: {
        workspace_id: input.workspaceId,
        OR: [
          { contacts: { none: {} } },
          { projects: { none: {} } },
          { contract_value: null },
          { AND: [{ plan_name: null }, { service_type: null }] },
        ],
      },
    });
    await recordActivity({
      workspace_id: input.workspaceId,
      actor_id: input.actorId,
      type: "automation_client_health_report_generated",
      entity_type: "client_health_report",
      entity_id: input.workspaceId,
      metadata: {
        rule_id: input.ruleId,
        rule_name: input.ruleName,
        generated_at: input.now.toISOString(),
        clients_at_risk: clientsAtRisk,
      },
    });
    return { ok: true };
  }

  if (actionType === "apply_template") {
    return { ok: false, note: "apply_template needs an explicit onboarding/template workflow before execution" };
  }

  return { ok: false, note: `Unsupported action ${actionType}` };
}

async function createAutomationNotifications(
  userIds: string[],
  input: {
    workspaceId: string;
    actorId: string;
    ruleName: string;
    trigger: string;
    target: AutomationTarget;
  },
) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  for (const userId of uniqueUserIds) {
    await prisma.notification.create({
      data: {
        type: input.target.taskId ? "due_soon" : "status_changed",
        user_id: userId,
        task_id: input.target.taskId ?? undefined,
        workspace_id: input.target.taskId ? undefined : input.workspaceId,
        data: {
          task_title: input.target.taskId ? input.target.label : `Automation alert: ${input.target.label}`,
          actor_id: input.actorId,
          actor_name: "Automation",
          new_status: "attention",
          rule_name: input.ruleName,
          trigger: input.trigger,
        },
      },
    });
  }
  await recordActivity({
    workspace_id: input.workspaceId,
    actor_id: input.actorId,
    type: "automation_notification_sent",
    entity_type: input.target.kind,
    entity_id: input.target.id,
    project_id: input.target.projectId ?? undefined,
    task_id: input.target.taskId ?? undefined,
    company_id: input.target.companyId ?? undefined,
    metadata: { rule_name: input.ruleName, trigger: input.trigger, recipients: uniqueUserIds.length },
  });
}

function getString(config: Record<string, unknown> | undefined, key: string) {
  const value = config?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPriority(config: Record<string, unknown> | undefined, key: string) {
  const value = getString(config, key);
  return value === "low" || value === "medium" || value === "high" ? value : null;
}
