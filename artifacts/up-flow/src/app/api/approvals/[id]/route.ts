import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-response";
import { requireCurrentWorkspace, requireWorkspaceAdmin } from "@/lib/api/scope";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity";
import { approvalTimestampFor, APPROVAL_STATUSES, syncEntityApprovalState } from "@/lib/approval-workflow";
import { withErrorReporting } from "@/lib/with-error-reporting";

const UpdateApprovalSchema = z.object({
  status: z.enum(APPROVAL_STATUSES).optional(),
  stage: z.string().trim().min(1).max(80).optional(),
  approver_id: z.string().uuid().nullable().optional(),
  requested_changes: z.string().trim().max(10_000).nullable().optional(),
  comment: z.string().trim().max(10_000).nullable().optional(),
});

async function PATCH_handler(req: NextRequest, { params }: { params: { id: string } }) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;
  const admin = requireWorkspaceAdmin(auth, scope.workspaceId);
  if (!admin.ok) return admin.response;

  const existing = await prisma.approvalRequest.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Approval not found" }, { status: 404 });

  const parsed = UpdateApprovalSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid approval update", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const nextStatus = parsed.data.status ?? existing.status;
  const nextStage = parsed.data.stage ?? existing.stage;
  const approvedAt = parsed.data.status ? approvalTimestampFor(nextStatus) : undefined;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.approvalRequest.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        stage: nextStage,
        ...(parsed.data.approver_id !== undefined && { approver_id: parsed.data.approver_id }),
        ...(parsed.data.requested_changes !== undefined && { requested_changes: parsed.data.requested_changes }),
        ...(approvedAt !== undefined && { approved_at: approvedAt }),
      },
    });
    await tx.approvalEvent.create({
      data: {
        approval_id: row.id,
        workspace_id: scope.workspaceId,
        actor_id: auth.prismaUser.id,
        from_status: existing.status,
        to_status: nextStatus,
        comment: parsed.data.comment ?? parsed.data.requested_changes ?? null,
      },
    });
    return row;
  });

  await syncEntityApprovalState({
    workspaceId: scope.workspaceId,
    entityType: updated.entity_type,
    entityId: updated.entity_id,
    status: updated.status,
    stage: updated.stage,
    approvedAt,
  });

  await recordActivity({
    workspace_id: scope.workspaceId,
    actor_id: auth.prismaUser.id,
    type: "approval_request_updated",
    entity_type: updated.entity_type,
    entity_id: updated.entity_id,
    metadata: { approval_id: updated.id, old_status: existing.status, new_status: updated.status },
  });

  return NextResponse.json(updated);
}

export const PATCH = withErrorReporting("api:approvals/id:PATCH", PATCH_handler);
