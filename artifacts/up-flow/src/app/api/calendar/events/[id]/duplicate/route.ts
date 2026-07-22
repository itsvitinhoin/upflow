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

  const source = await loadCalendarEventDetail(id);
  if (!source || !canAccessWorkspace(auth, source.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canManageCalendarEvent(auth, source))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const duplicate = await prisma.calendarEvent.create({
    data: {
      workspace_id: source.workspace_id,
      title: `${source.title} (copy)`,
      description: source.description,
      type: source.type,
      starts_at: source.starts_at,
      ends_at: source.ends_at,
      timezone: source.timezone,
      created_by: auth.prismaUser.id,
      project_id: source.project_id,
      task_id: source.task_id,
      company_id: source.company_id,
      space_id: source.space_id,
      responsible_user_id: source.responsible_user_id,
      priority: source.priority,
      location: source.location,
      meeting_url: source.meeting_url,
      color: source.color,
      attendees: { create: source.attendees.map((attendee) => ({ user_id: attendee.user_id })) },
      reminders: {
        create: source.reminders.map((reminder) => ({
          minutes_before: reminder.minutes_before,
          enabled: true,
        })),
      },
      attachments: {
        create: source.attachments
          .filter((attachment) => attachment.kind === "link" || attachment.kind === "document")
          .map((attachment) =>
            attachment.kind === "link"
              ? {
                  kind: "link" as const,
                  name: attachment.name,
                  url: attachment.url!,
                  created_by: auth.prismaUser.id,
                }
              : {
                  kind: "document" as const,
                  name: attachment.name,
                  document_id: attachment.document_id!,
                  created_by: auth.prismaUser.id,
                },
          ),
      },
    },
    include: calendarEventDetailInclude,
  });

  await recordActivity({
    workspace_id: source.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "calendar_event_duplicated",
    entity_type: "calendar_event",
    entity_id: duplicate.id,
    project_id: duplicate.project_id,
    task_id: duplicate.task_id,
    company_id: duplicate.company_id,
    metadata: { source_event_id: source.id, title: duplicate.title },
  });
  return NextResponse.json(serializeCalendarEvent(duplicate), { status: 201 });
}

export const POST = withErrorReporting("api:calendar/events/duplicate:POST", POST_handler);
