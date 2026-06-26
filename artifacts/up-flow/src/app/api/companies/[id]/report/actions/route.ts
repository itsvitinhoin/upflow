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

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: activityType,
    entity_type: "client_report",
    entity_id: company.id,
    company_id: company.id,
    metadata: {
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
  });
}

export const POST = withErrorReporting("api:companies/id/report/actions:POST", POST_handler);
