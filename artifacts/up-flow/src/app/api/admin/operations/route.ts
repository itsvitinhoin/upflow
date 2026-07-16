import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { requireCurrentWorkspace, requireWorkspaceAdmin } from "@/lib/api/scope";
import { prisma } from "@/lib/prisma";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;
  const admin = requireWorkspaceAdmin(auth, scope.workspaceId);
  if (!admin.ok) return admin.response;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    failedAutomations,
    pendingApprovals,
    reportApprovalsWaiting,
    inviteFailures,
    permissionChanges,
    clients,
    overdueTaskCompanies,
    latestRuns,
  ] = await Promise.all([
    prisma.automationRun.count({
      where: { workspace_id: scope.workspaceId, OR: [{ status: "failed" }, { status: "partial" }, { failure_count: { gt: 0 } }] },
    }),
    prisma.approvalRequest.count({
      where: { workspace_id: scope.workspaceId, status: { in: ["internal_review", "ready_for_client", "changes_requested"] } },
    }),
    prisma.clientReport.count({
      where: { workspace_id: scope.workspaceId, status: { in: ["draft", "internal_review", "ready_for_client", "approved"] } },
    }),
    prisma.workspaceInvite.count({ where: { workspace_id: scope.workspaceId, send_status: "failed" } }),
    prisma.activityEvent.count({
      where: {
        workspace_id: scope.workspaceId,
        created_at: { gte: sevenDaysAgo },
        OR: [
          { type: { contains: "permission", mode: "insensitive" } },
          { type: { contains: "member", mode: "insensitive" } },
          { type: { contains: "invite", mode: "insensitive" } },
          { entity_type: "workspace_member" },
        ],
      },
    }),
    prisma.company.findMany({
      where: { workspace_id: scope.workspaceId },
      select: {
        id: true,
        name: true,
        contract_value: true,
        plan_name: true,
        service_type: true,
        contacts: { select: { id: true } },
        projects: { select: { id: true }, take: 1 },
        activity_events: { select: { created_at: true }, orderBy: [{ created_at: "desc" }, { id: "asc" }], take: 1 },
      },
      take: 100,
    }),
    prisma.task.groupBy({
      by: ["company_id"],
      where: {
        company_id: { not: null },
        status: { not: "done" },
        due_date: { not: null, lt: today },
        project: { workspace_id: scope.workspaceId },
      },
      _count: { _all: true },
    }),
    prisma.automationRun.findMany({
      where: { workspace_id: scope.workspaceId },
      orderBy: [{ started_at: "desc" }, { id: "asc" }],
      take: 10,
      include: { rule: { select: { id: true, name: true } } },
    }),
  ]);

  const overdueCompanyIds = new Set(
    overdueTaskCompanies
      .map((row) => row.company_id)
      .filter((companyId): companyId is string => Boolean(companyId)),
  );
  const clientsAtRisk = clients.filter((company) => {
    const latest = company.activity_events[0]?.created_at ?? null;
    const stale = !latest || latest < sevenDaysAgo;
    const overdue = overdueCompanyIds.has(company.id);
    return (
      stale ||
      overdue ||
      company.contacts.length === 0 ||
      company.projects.length === 0 ||
      company.contract_value == null ||
      (!company.plan_name && !company.service_type)
    );
  });

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    counts: {
      failed_automations: failedAutomations,
      approvals_waiting: pendingApprovals,
      report_approvals_waiting: reportApprovalsWaiting,
      clients_at_risk: clientsAtRisk.length,
      invite_failures: inviteFailures,
      permission_changes_7d: permissionChanges,
    },
    latest_runs: latestRuns,
    clients_at_risk: clientsAtRisk.slice(0, 10).map((company) => ({ id: company.id, name: company.name })),
    health_links: ["/api/health", "/api/admin/health"],
  });
}

export const GET = withErrorReporting("api:admin/operations:GET", GET_handler);
