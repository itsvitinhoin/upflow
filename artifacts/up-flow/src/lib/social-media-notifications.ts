import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/log-error";
import { broadcastNotification } from "@/lib/supabase-server";

type SocialMediaNotificationSource =
  | "social_media_moodboard_ready"
  | "social_media_post_overdue";

type SocialMediaNotificationInput = {
  source: SocialMediaNotificationSource;
  planId: string;
  taskId: string;
  taskTitle: string;
  actorId?: string | null;
  actorName?: string | null;
  assigneeId?: string | null;
  scheduledPublishingDate?: string | null;
};

/**
 * Notify the people directly responsible for a Social Media plan, together
 * with the Creative & Design service lead. The regular Notification model
 * remains the delivery channel, so recipients get the existing inbox and
 * realtime behaviour without a parallel notification system.
 */
export async function notifySocialMediaWorkflow(input: SocialMediaNotificationInput) {
  const plan = await prisma.socialMediaContentPlan.findUnique({
    where: { id: input.planId },
    select: {
      social_manager_id: true,
      designer_id: true,
      project: {
        select: {
          owner_id: true,
          workspace_id: true,
        },
      },
    },
  });
  if (!plan) return 0;

  const leaders = await prisma.serviceLeaderMapping.findMany({
    where: {
      workspace_id: plan.project.workspace_id,
      active: true,
      service: { in: ["Creative & Design", "creative_design"] },
    },
    select: { leader_id: true, backup_leader_id: true },
  });

  const recipients = Array.from(
    new Set([
      input.assigneeId,
      plan.social_manager_id,
      plan.designer_id,
      ...leaders.flatMap((leader) => [leader.leader_id, leader.backup_leader_id]),
      plan.project.owner_id,
    ]),
  ).filter((id): id is string => Boolean(id) && id !== input.actorId);
  if (recipients.length === 0) return 0;

  const scheduled = input.scheduledPublishingDate ?? "";
  const notificationKey = `${input.source}:${input.taskId}:${scheduled}`;
  const existing = await prisma.notification.findMany({
    where: {
      type: "status_changed",
      task_id: input.taskId,
      user_id: { in: recipients },
      data: { path: ["notification_key"], equals: notificationKey },
    },
    select: { user_id: true },
  });
  const existingUsers = new Set(existing.map((notification) => notification.user_id));
  const pending = recipients.filter((userId) => !existingUsers.has(userId));
  if (pending.length === 0) return 0;

  await prisma.notification.createMany({
    data: pending.map((user_id) => ({
      type: "status_changed" as const,
      user_id,
      task_id: input.taskId,
      data: {
        source: input.source,
        notification_key: notificationKey,
        social_media_plan_id: input.planId,
        task_title: input.taskTitle,
        actor_name: input.actorName ?? "Social Media Calendar",
        scheduled_publishing_date: input.scheduledPublishingDate ?? null,
      },
    })),
  });

  await Promise.all(
    pending.map((userId) =>
      broadcastNotification(userId).catch((error) =>
        logError("social-media:notify:broadcast", error, {
          user_id: userId,
          task_id: input.taskId,
          source: input.source,
        }),
      ),
    ),
  );

  return pending.length;
}
