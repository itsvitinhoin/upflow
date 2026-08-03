import type { Prisma } from "@prisma/client";
import { queueGoogleCalendarEventDeletionInTransaction } from "@/lib/google-calendar";

type Tx = Prisma.TransactionClient;

export interface DeletedCalendarEventsWithGoogleTombstones {
  count: number;
  googleCalendarDeletionJobIds: string[];
}

/**
 * Deletes a group of calendar events without leaving pending Google Calendar
 * creates behind. The tombstones are persisted in the caller's transaction,
 * so the retry worker can remove the provider copies after the local records
 * are gone.
 */
export async function deleteCalendarEventsWithGoogleTombstones(
  tx: Tx,
  where: Prisma.CalendarEventWhereInput,
): Promise<DeletedCalendarEventsWithGoogleTombstones> {
  const events = await tx.calendarEvent.findMany({
    where,
    select: { id: true },
  });
  const eventIds = events.map((event) => event.id);
  if (eventIds.length === 0) {
    return { count: 0, googleCalendarDeletionJobIds: [] };
  }

  const googleCalendarDeletionJobIds: string[] = [];
  for (const eventId of eventIds) {
    googleCalendarDeletionJobIds.push(
      ...(await queueGoogleCalendarEventDeletionInTransaction(tx, eventId)),
    );
  }

  // Upserts require `event_id` under the database payload constraint. Remove
  // all obsolete upserts only after the deletion tombstones above are durable;
  // the delete jobs retain their provider identifiers after the FK sets their
  // event_id to NULL.
  await tx.googleCalendarSyncJob.deleteMany({
    where: {
      event_id: { in: eventIds },
      operation: "upsert",
    },
  });

  const deleted = await tx.calendarEvent.deleteMany({
    where: { id: { in: eventIds } },
  });
  return { count: deleted.count, googleCalendarDeletionJobIds };
}
