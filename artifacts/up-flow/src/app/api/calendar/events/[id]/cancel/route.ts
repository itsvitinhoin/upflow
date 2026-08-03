import { after, NextRequest, NextResponse } from "next/server";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import {
  processGoogleCalendarSyncJob,
  queueGoogleCalendarEventDeletionInTransaction,
} from "@/lib/google-calendar";
import { logError } from "@/lib/log-error";
import { prisma } from "@/lib/prisma";
import { withErrorReporting } from "@/lib/with-error-reporting";
import {
  calendarEventDetailInclude,
  canManageCalendarEvent,
  loadCalendarEventDetail,
  serializeCalendarEvent,
} from "../../event-detail";

type RouteContext = { params: Promise<{ id: string }> };

async function POST_handler(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const event = await loadCalendarEventDetail(id);
  if (!event || !canAccessWorkspace(auth, event.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canManageCalendarEvent(auth, event))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (event.status === "cancelled") return NextResponse.json(serializeCalendarEvent(event));

  let cancelled: NonNullable<Awaited<ReturnType<typeof loadCalendarEventDetail>>>;
  let googleCalendarDeletionJobIds: string[];
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock Google delivery before changing the local event. This establishes
      // a single ordering with an in-flight provider upsert and records a
      // durable delete tombstone if Google is temporarily unavailable.
      const jobIds = await queueGoogleCalendarEventDeletionInTransaction(tx, event.id);
      const updated = await tx.calendarEvent.update({
        where: { id: event.id },
        data: {
          status: "cancelled",
          cancelled_at: new Date(),
          cancelled_by: auth.prismaUser.id,
          reminders: { updateMany: { where: {}, data: { enabled: false } } },
        },
        include: calendarEventDetailInclude,
      });
      return { updated, jobIds };
    });
    cancelled = result.updated;
    googleCalendarDeletionJobIds = result.jobIds;
  } catch (error) {
    logError("api:calendar/events/cancel:google-calendar-tombstone", error, { event_id: event.id });
    return NextResponse.json(
      { error: "Could not safely cancel the calendar event. Please retry." },
      { status: 503 },
    );
  }
  await recordActivity({
    workspace_id: event.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "calendar_event_cancelled",
    entity_type: "calendar_event",
    entity_id: event.id,
    project_id: event.project_id,
    task_id: event.task_id,
    company_id: event.company_id,
    metadata: { title: event.title },
  });
  for (const googleCalendarJobId of googleCalendarDeletionJobIds) {
    after(() =>
      processGoogleCalendarSyncJob(googleCalendarJobId).catch((error) =>
        logError("api:calendar/events/cancel:google-calendar-sync", error, { event_id: cancelled.id }),
      ),
    );
  }
  return NextResponse.json(serializeCalendarEvent(cancelled));
}

export const POST = withErrorReporting("api:calendar/events/cancel:POST", POST_handler);
