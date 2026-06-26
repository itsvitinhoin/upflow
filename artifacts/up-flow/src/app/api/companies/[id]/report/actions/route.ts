import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-response";
import { requireCurrentWorkspace, requireWorkspaceAdmin } from "@/lib/api/scope";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const ReportActionSchema = z.object({
  action: z.enum(["approve_internal", "send_to_client", "archive_report"]),
  status: z.enum(["draft", "internal_review", "ready_for_client", "sent_to_client", "approved", "changes_requested", "completed"]),
  period: z.object({
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
  }),
  narrative: z.string().max(20_000).optional(),
  markdown: z.string().max(50_000).optional(),
});

async function POST_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;
  const admin = requireWorkspaceAdmin(auth, scope.workspaceId);
  if (!admin.ok) return admin.response;

  const company = await prisma.company.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId },
    select: { id: true, name: true },
  });
  if (!company) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const parsed = ReportActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report action", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const activityType = {
    approve_internal: "client_report_approved_internally",
    send_to_client: "client_report_marked_sent",
    archive_report: "client_report_archived",
  }[parsed.data.action];
  const periodFrom = new Date(parsed.data.period.from);
  const periodTo = new Date(parsed.data.period.to);
  if (Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime()) || periodTo <= periodFrom) {
    return NextResponse.json({ error: "Invalid report period" }, { status: 400 });
  }
  const now = new Date();
  const report = await prisma.$transaction(async (tx) => {
    const latest = await tx.clientReport.findFirst({
      where: {
        workspace_id: scope.workspaceId,
        company_id: company.id,
        period_from: periodFrom,
        period_to: periodTo,
      },
      orderBy: [{ version: "desc" }, { created_at: "desc" }],
    });
    const nextData = {
      status: parsed.data.status,
      narrative: parsed.data.narrative ?? null,
      markdown: parsed.data.markdown ?? null,
      ...(parsed.data.action === "approve_internal" && {
        approved_at: now,
        approved_by: auth.prismaUser.id,
      }),
      ...(parsed.data.action === "send_to_client" && {
        sent_at: now,
        sent_by: auth.prismaUser.id,
      }),
      ...(parsed.data.action === "archive_report" && {
        archived_at: now,
      }),
    };
    return latest
      ? tx.clientReport.update({
          where: { id: latest.id },
          data: nextData,
        })
      : tx.clientReport.create({
          data: {
            workspace_id: scope.workspaceId,
            company_id: company.id,
            author_id: auth.prismaUser.id,
            title: `${company.name} client report`,
            period_from: periodFrom,
            period_to: periodTo,
            ...nextData,
          },
        });
  });

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: activityType,
    entity_type: "client_report",
    entity_id: report.id,
    company_id: company.id,
    metadata: {
      report_id: report.id,
      client_name: company.name,
      status: parsed.data.status,
      period: parsed.data.period,
      narrative: parsed.data.narrative ?? null,
      markdown: parsed.data.markdown ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    action: parsed.data.action,
    status: parsed.data.status,
    report,
  });
}

export const POST = withErrorReporting("api:companies/id/report/actions:POST", POST_handler);
