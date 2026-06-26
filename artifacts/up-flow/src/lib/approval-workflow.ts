import { prisma } from "@/lib/prisma";

export const APPROVAL_STATUSES = [
  "draft",
  "internal_review",
  "ready_for_client",
  "sent_to_client",
  "approved",
  "changes_requested",
  "completed",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export async function syncEntityApprovalState(input: {
  workspaceId: string;
  entityType: string;
  entityId: string;
  status: string;
  stage: string;
  approvedAt?: Date | null;
  requestedAt?: Date | null;
}) {
  const data = {
    approval_status: input.status,
    approval_stage: input.stage,
    ...(input.requestedAt !== undefined && { approval_requested_at: input.requestedAt }),
    ...(input.approvedAt !== undefined && { approval_approved_at: input.approvedAt }),
  };

  if (input.entityType === "task") {
    await prisma.task.updateMany({
      where: { id: input.entityId, project: { workspace_id: input.workspaceId } },
      data,
    });
  }
  if (input.entityType === "doc") {
    await prisma.doc.updateMany({
      where: { id: input.entityId, workspace_id: input.workspaceId },
      data,
    });
  }
  if (input.entityType === "project" || input.entityType === "campaign" || input.entityType === "deliverable") {
    await prisma.project.updateMany({
      where: { id: input.entityId, workspace_id: input.workspaceId },
      data,
    });
  }
}

export function approvalTimestampFor(status: string) {
  return status === "approved" || status === "completed" ? new Date() : null;
}
