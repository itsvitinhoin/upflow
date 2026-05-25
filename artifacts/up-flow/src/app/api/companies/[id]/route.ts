import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const UpdateCompanySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  website: z.string().trim().url().nullable().optional(),
  status: z.string().trim().optional(),
  commercial_status: z.string().trim().nullable().optional(),
  contract_value: z.number().nullable().optional(),
  commission: z.number().nullable().optional(),
  industry: z.string().trim().nullable().optional(),
  service_type: z.string().trim().nullable().optional(),
  plan_name: z.string().trim().nullable().optional(),
  billing_cycle: z.string().trim().nullable().optional(),
  included_services: z.array(z.string().trim().min(1)).max(50).nullable().optional(),
  plan_notes: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

async function getCompany(id: string, workspaceId: string) {
  const company = await prisma.company.findFirst({
    where: { id, workspace_id: workspaceId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contacts: { orderBy: [{ created_at: "desc" }, { id: "asc" }] },
      notes_log: {
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      projects: {
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          status: true,
          due_date: true,
          tasks: {
            select: { id: true, title: true, status: true, priority: true, due_date: true },
            orderBy: [{ due_date: "asc" }, { created_at: "desc" }],
          },
        },
      },
      calendar_events: {
        orderBy: [{ starts_at: "desc" }, { id: "asc" }],
        take: 50,
      },
      activity_events: {
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        take: 50,
        include: { actor: { select: { id: true, name: true, email: true, avatar_url: true } } },
      },
    },
  });
  if (!company) return null;

  const [tasks, timeEntries] = await Promise.all([
    prisma.task.findMany({
      where: {
        project: { company_id: company.id, workspace_id: workspaceId },
      },
      orderBy: [{ due_date: "asc" }, { created_at: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        due_date: true,
        project: { select: { id: true, name: true } },
      },
      take: 100,
    }),
    prisma.timeEntry.findMany({
      where: {
        workspace_id: workspaceId,
        project: { company_id: company.id },
      },
      orderBy: [{ started_at: "desc" }, { id: "asc" }],
      select: {
        id: true,
        started_at: true,
        stopped_at: true,
        duration_seconds: true,
        status: true,
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      take: 100,
    }),
  ]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(todayStart.getDate() - 7);
  const openTasks = tasks.filter((task) => task.status !== "done");
  const overdueTasks = openTasks.filter((task) => task.due_date && task.due_date < todayStart);
  const lastActivityAt = company.activity_events[0]?.created_at ?? null;
  const riskReasons: string[] = [];
  if (company.projects.length === 0) riskReasons.push("No linked projects");
  if (company.contacts.length === 0) riskReasons.push("No contacts");
  if (overdueTasks.length > 0) riskReasons.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`);
  if (!lastActivityAt || lastActivityAt < sevenDaysAgo) riskReasons.push("No activity in 7 days");
  if (company.contract_value == null) riskReasons.push("No contract value");
  const trackedSeconds = timeEntries.reduce((sum, entry) => {
    if (entry.status === "running") {
      return sum + Math.max(0, Math.floor((Date.now() - entry.started_at.getTime()) / 1000));
    }
    return sum + entry.duration_seconds;
  }, 0);

  return {
    ...company,
    tasks,
    time_entries: timeEntries,
    summary: {
      project_count: company.projects.length,
      open_task_count: openTasks.length,
      overdue_task_count: overdueTasks.length,
      meeting_count: company.calendar_events.length,
      contact_count: company.contacts.length,
      tracked_seconds: trackedSeconds,
      risk_reasons: riskReasons,
      profitability_ratio:
        company.contract_value && company.commission != null
          ? company.commission / company.contract_value
          : null,
    },
  };
}

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const company = await getCompany(params.id, auth.currentWorkspaceId);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(company);
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const company = await prisma.company.findFirst({
    where: { id: params.id, workspace_id: auth.currentWorkspaceId },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (company.owner_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, company.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = UpdateCompanySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid company", issues: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.company.update({
    where: { id: company.id },
    data: parsed.data,
  });

  await recordActivity({
    workspace_id: company.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "company_updated",
    entity_type: "company",
    entity_id: company.id,
    company_id: company.id,
    metadata: { name: updated.name },
  });

  return NextResponse.json(updated);
}

export const GET = withErrorReporting("api:companies/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:companies/id:PATCH", PATCH_handler);
