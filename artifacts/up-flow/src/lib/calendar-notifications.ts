import type { CalendarEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/log-error";
import { broadcastNotification } from "@/lib/supabase-server";

type CalendarNotificationEvent = {
  id: string;
  workspace_id: string;
  title: string;
  type: CalendarEventType;
  starts_at: Date;
};

export async function notifyCalendarEventAssignees({
  event,
  attendeeIds,
  actor,
}: {
  event: CalendarNotificationEvent;
  attendeeIds: string[];
  actor: { id: string; name?: string | null; email?: string | null };
}) {
  const targets = Array.from(new Set(attendeeIds)).filter(Boolean);
  if (targets.length === 0) return 0;

  await prisma.notification.createMany({
    data: targets.map((user_id) => ({
      type: "assigned",
      user_id,
      workspace_id: event.workspace_id,
      data: {
        source: "calendar_event_assigned",
        calendar_event_id: event.id,
        calendar_event_title: event.title,
        calendar_event_type: event.type,
        starts_at: event.starts_at.toISOString(),
        actor_id: actor.id,
        actor_name: actor.name ?? actor.email ?? null,
      },
    })),
  });

  await Promise.all(
    targets.map((userId) =>
      broadcastNotification(userId).catch((err) =>
        logError("calendar:notify:broadcast", err, {
          user_id: userId,
          event_id: event.id,
        }),
      ),
    ),
  );

  return targets.length;
}
