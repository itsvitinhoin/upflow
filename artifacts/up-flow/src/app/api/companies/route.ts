import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { recordActivity } from "@/lib/activity";
import { buildPage, parsePagination } from "@/lib/pagination";

const CompanySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  website: z.string().trim().url().optional().nullable(),
  status: z.string().trim().optional(),
  commercial_status: z.string().trim().optional().nullable(),
  contract_value: z.number().optional().nullable(),
  commission: z.number().optional().nullable(),
  industry: z.string().trim().optional().nullable(),
  service_type: z.string().trim().optional().nullable(),
  plan_name: z.string().trim().optional().nullable(),
  billing_cycle: z.string().trim().optional().nullable(),
  included_services: z.array(z.string().trim().min(1)).max(50).optional().nullable(),
  plan_notes: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const { limit, cursor } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 });
  const rows = await prisma.company.findMany({
    where: { workspace_id: auth.currentWorkspaceId },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contacts: { select: { id: true } },
      calendar_events: { select: { id: true } },
      activity_events: {
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        take: 1,
        select: {
          type: true,
          created_at: true,
          actor: { select: { id: true, name: true, email: true } },
        },
      },
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          due_date: true,
          assignee: { select: { id: true, name: true, email: true } },
        },
      },
      projects: {
        select: {
          id: true,
          name: true,
          status: true,
          due_date: true,
          owner: { select: { id: true, name: true, email: true } },
          time_entries: {
            select: {
              id: true,
              started_at: true,
              duration_seconds: true,
              status: true,
            },
          },
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              due_date: true,
              assignee: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  const page = buildPage(rows, limit);
  return NextResponse.json({
    items: page.items.map(withCompanySummary),
    nextCursor: page.nextCursor,
  });
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  const parsed = CompanySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid company", issues: parsed.error.flatten() }, { status: 400 });
  }

  const company = await prisma.company.create({
    data: {
      workspace_id: auth.currentWorkspaceId,
      owner_id: auth.prismaUser.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      website: parsed.data.website || null,
      status: parsed.data.status || "active",
      commercial_status: parsed.data.commercial_status || null,
      contract_value: parsed.data.contract_value ?? null,
      commission: parsed.data.commission ?? null,
      industry: parsed.data.industry || null,
      service_type: parsed.data.service_type || null,
      plan_name: parsed.data.plan_name || null,
      billing_cycle: parsed.data.billing_cycle || null,
      included_services: parsed.data.included_services?.length ? parsed.data.included_services : undefined,
      plan_notes: parsed.data.plan_notes || null,
      notes: parsed.data.notes || null,
    },
  });

  await recordActivity({
    workspace_id: auth.currentWorkspaceId,
    actor_id: auth.prismaUser.id,
    type: "company_created",
    entity_type: "company",
    entity_id: company.id,
    metadata: { name: company.name },
  });

  return NextResponse.json(company, { status: 201 });
}

export const GET = withErrorReporting("api:companies:GET", GET_handler);
export const POST = withErrorReporting("api:companies:POST", POST_handler);

function withCompanySummary<T extends {
  contract_value: number | null;
  commission: number | null;
  owner?: { id: string; name: string; email: string } | null;
  contacts?: Array<{ id: string }>;
  calendar_events?: Array<{ id: string }>;
  activity_events?: Array<{
    type: string;
    created_at: Date;
    actor?: { id: string; name: string; email: string } | null;
  }>;
  tasks?: Array<{
    id: string;
    title: string;
    status: string;
    due_date: Date | null;
    assignee?: { id: string; name: string; email: string } | null;
  }>;
  projects?: Array<{
    id: string;
    name: string;
    status: string;
    due_date: Date | null;
    owner?: { id: string; name: string; email: string } | null;
    time_entries?: Array<{
      id: string;
      started_at: Date;
      duration_seconds: number;
      status: string;
    }>;
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      due_date: Date | null;
      assignee?: { id: string; name: string; email: string } | null;
    }>;
  }>;
}>(company: T) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(todayStart.getDate() - 7);
  const projects = company.projects ?? [];
  const tasksById = new Map<string, NonNullable<T["tasks"]>[number] | NonNullable<T["projects"]>[number]["tasks"][number]>();
  for (const task of company.tasks ?? []) tasksById.set(task.id, task);
  for (const task of projects.flatMap((project) => project.tasks)) tasksById.set(task.id, task);
  const tasks = Array.from(tasksById.values());
  const timeEntries = projects.flatMap((project) => project.time_entries ?? []);
  const activeProjects = projects.filter((project) => project.status === "active");
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdueTasks = openTasks.filter((task) => task.due_date && task.due_date < todayStart);
  const nextDeadline =
    [
      ...projects
        .map((project) => project.due_date)
        .filter((date): date is Date => Boolean(date)),
      ...openTasks
        .map((task) => task.due_date)
        .filter((date): date is Date => Boolean(date)),
    ].sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const lastActivityAt = company.activity_events?.[0]?.created_at ?? null;
  const riskReasons: string[] = [];

  if (projects.length === 0) riskReasons.push("No linked projects");
  if ((company.contacts?.length ?? 0) === 0) riskReasons.push("No contacts");
  if (overdueTasks.length > 0) riskReasons.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`);
  if (!lastActivityAt || lastActivityAt < sevenDaysAgo) riskReasons.push("No activity in 7 days");
  if (company.contract_value == null) riskReasons.push("No contract value");
  const trackedSeconds = timeEntries.reduce((sum, entry) => {
    if (entry.status === "running") {
      return sum + Math.max(0, Math.floor((Date.now() - entry.started_at.getTime()) / 1000));
    }
    return sum + entry.duration_seconds;
  }, 0);
  const trackedHours = trackedSeconds / 3600;
  const assignedMembers = new Map<string, { id: string; name: string; email: string }>();
  if (company.owner) assignedMembers.set(company.owner.id, company.owner);
  for (const project of projects) {
    if (project.owner) assignedMembers.set(project.owner.id, project.owner);
  }
  for (const task of tasks) {
    if (task.assignee) assignedMembers.set(task.assignee.id, task.assignee);
  }
  const hasPlanData = Boolean(company.contract_value != null || company.commission != null);
  const hasServiceData = Boolean((company as { service_type?: unknown }).service_type || (company as { plan_name?: unknown }).plan_name);
  const healthStatus =
    riskReasons.some((reason) => reason.includes("overdue") || reason === "No linked projects")
      ? "risk"
      : riskReasons.length > 0
        ? "attention"
        : projects.length === 0 && !hasPlanData && !hasServiceData
          ? "not_enough_data"
          : "healthy";

  return {
    ...company,
    summary: {
      project_count: projects.length,
      active_project_count: activeProjects.length,
      open_task_count: openTasks.length,
      overdue_task_count: overdueTasks.length,
      meeting_count: company.calendar_events?.length ?? 0,
      contact_count: company.contacts?.length ?? 0,
      tracked_seconds: trackedSeconds,
      risk_reasons: riskReasons,
      health_status: healthStatus,
      next_deadline: nextDeadline,
      latest_activity: company.activity_events?.[0] ?? null,
      assigned_members: Array.from(assignedMembers.values()).slice(0, 5),
      profitability_ratio:
        company.contract_value && company.commission != null
          ? company.commission / company.contract_value
          : null,
      contract_value_per_tracked_hour:
        company.contract_value != null && trackedHours > 0
          ? company.contract_value / trackedHours
          : null,
      commission_per_tracked_hour:
        company.commission != null && trackedHours > 0
          ? company.commission / trackedHours
          : null,
    },
  };
}
