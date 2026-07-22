import { NextRequest, NextResponse } from "next/server";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
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

  const cancelled = await prisma.calendarEvent.update({
    where: { id: event.id },
    data: {
      status: "cancelled",
      cancelled_at: new Date(),
      cancelled_by: auth.prismaUser.id,
      reminders: { updateMany: { where: {}, data: { enabled: false } } },
    },
    include: calendarEventDetailInclude,
  });
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
  return NextResponse.json(serializeCalendarEvent(cancelled));
}

export const POST = withErrorReporting("api:calendar/events/cancel:POST", POST_handler);
