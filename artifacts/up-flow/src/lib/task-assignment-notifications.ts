import type { Prisma } from "@prisma/client";
import { logError } from "@/lib/log-error";
import { prisma } from "@/lib/prisma";
import { broadcastNotification } from "@/lib/supabase-server";

export type TaskAssignmentNotificationInput = {
  taskId: string;
  userId: string | null | undefined;
  workspaceId?: string | null;
  data?: Prisma.InputJsonValue;
};

/**
 * Persists an assignment notification before sending its best-effort realtime
 * signal. Keeping the durable notification first means a missed broadcast is
 * recovered by the inbox refresh instead of dropping the assignment entirely.
 */
export async function notifyTaskAssignee(input: TaskAssignmentNotificationInput) {
  if (!input.userId) return false;

  try {
    await prisma.notification.create({
      data: {
        type: "assigned",
        user_id: input.userId,
        task_id: input.taskId,
        workspace_id: input.workspaceId ?? undefined,
        data: input.data ?? undefined,
      },
    });
  } catch (error) {
    logError("task-assignment-notification:persist", error, {
      task_id: input.taskId,
      user_id: input.userId,
      workspace_id: input.workspaceId ?? undefined,
    });
    return false;
  }

  await broadcastNotification(input.userId);
  return true;
}
