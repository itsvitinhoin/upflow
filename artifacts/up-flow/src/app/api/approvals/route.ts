import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-response";
import { requireCurrentWorkspace, requireWorkspaceAdmin } from "@/lib/api/scope";
import { buildPage, parsePagination } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity";
import { approvalTimestampFor, APPROVAL_STATUSES, syncEntityApprovalState } from "@/lib/approval-workflow";
import { withErrorReporting } from "@/lib/with-error-reporting";

const ApprovalSchema = z.object({
  entity_type: z.string().trim().min(1).max(60),
  entity_id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  status: z.enum(APPROVAL_STATUSES).default("internal_review"),
  stage: z.string().trim().min(1).max(80).default("internal_review"),
  approver_id: z.string().uuid().nullable().optional(),
  requested_changes: z.string().trim().max(10_000).nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const { searchParams } = new URL(req.url);
  const { limit, cursor } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 });
  const status = searchParams.get("status")?.trim();
  const entityType = searchParams.get("entity_type")?.trim();
  const approverId = searchParams.get("approver_id")?.trim();
  const where: Prisma.ApprovalRequestWhereInput = {
    workspace_id: scope.workspaceId,
    ...(status ? { status } : {}),
    ...(entityType ? { entity_type: entityType } : {}),
    ...(approverId ? { approver_id: approverId } : {}),
  };

  const rows = await prisma.approvalRequest.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ updated_at: "desc" }, { id: "asc" }],
    include: {
      requester: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } },
      events: {
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        take: 5,
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  return NextResponse.json(buildPage(rows, limit));
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;
  const admin = requireWorkspaceAdmin(auth, scope.workspaceId);
  if (!admin.ok) return admin.response;

  const parsed = ApprovalSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid approval request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const approvedAt = approvalTimestampFor(parsed.data.status);
  const approval = await prisma.$transaction(async (tx) => {
    const created = await tx.approvalRequest.create({
      data: {
        workspace_id: scope.workspaceId,
        entity_type: parsed.data.entity_type,
        entity_id: parsed.data.entity_id,
        title: parsed.data.title,
        status: parsed.data.status,
        stage: parsed.data.stage,
        requested_by: auth.prismaUser.id,
        approver_id: parsed.data.approver_id ?? null,
        requested_changes: parsed.data.requested_changes ?? null,
        due_at: parsed.data.due_at ? new Date(parsed.data.due_at) : null,
        approved_at: approvedAt,
        metadata: (parsed.data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    await tx.approvalEvent.create({
      data: {
        approval_id: created.id,
        workspace_id: scope.workspaceId,
        actor_id: auth.prismaUser.id,
        to_status: parsed.data.status,
        comment: parsed.data.requested_changes ?? null,
      },
    });
    return created;
  });

  await syncEntityApprovalState({
    workspaceId: scope.workspaceId,
    entityType: approval.entity_type,
    entityId: approval.entity_id,
    status: approval.status,
    stage: approval.stage,
    requestedAt: approval.created_at,
    approvedAt,
  });

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "approval_request_created",
    entity_type: approval.entity_type,
    entity_id: approval.entity_id,
    metadata: { approval_id: approval.id, status: approval.status, stage: approval.stage },
  });

  return NextResponse.json(approval, { status: 201 });
}

export const GET = withErrorReporting("api:approvals:GET", GET_handler);
export const POST = withErrorReporting("api:approvals:POST", POST_handler);
