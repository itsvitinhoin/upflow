import { NextRequest, NextResponse } from "next/server";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { withErrorReporting } from "@/lib/with-error-reporting";
import {
  canManageCalendarEvent,
  EVENT_ATTACHMENT_BUCKET,
  isCalendarEventStoragePath,
  loadCalendarEventDetail,
} from "../../../event-detail";

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

async function DELETE_handler(req: NextRequest, { params }: RouteContext) {
  const { id, attachmentId } = await params;
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
  const attachment = event.attachments.find((candidate) => candidate.id === attachmentId);
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  if (attachment.kind === "file") {
    if (
      attachment.storage_bucket !== EVENT_ATTACHMENT_BUCKET ||
      !isCalendarEventStoragePath(event.workspace_id, event.id, attachment.storage_path)
    ) {
      return NextResponse.json({ error: "Event attachment storage is invalid" }, { status: 409 });
    }
    const { error } = await getSupabaseAdminClient()
      .storage.from(EVENT_ATTACHMENT_BUCKET)
      .remove([attachment.storage_path!]);
    if (error) {
      return NextResponse.json({ error: "Could not remove the private event file" }, { status: 503 });
    }
  }

  await prisma.calendarEventAttachment.delete({ where: { id: attachment.id } });
  await recordActivity({
    workspace_id: event.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "calendar_event_attachment_deleted",
    entity_type: "calendar_event",
    entity_id: event.id,
    project_id: event.project_id,
    task_id: event.task_id,
    company_id: event.company_id,
    metadata: { attachment_id: attachment.id, attachment_name: attachment.name },
  });
  return NextResponse.json({ success: true });
}

export const DELETE = withErrorReporting(
  "api:calendar/events/attachment:DELETE",
  DELETE_handler,
);
