import { NextRequest, NextResponse } from "next/server";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { withErrorReporting } from "@/lib/with-error-reporting";
import {
  EVENT_ATTACHMENT_BUCKET,
  isCalendarEventStoragePath,
  loadCalendarEventDetail,
} from "../../../../event-detail";

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

async function GET_handler(req: NextRequest, { params }: RouteContext) {
  const { id, attachmentId } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const event = await loadCalendarEventDetail(id);
  if (!event || !canAccessWorkspace(auth, event.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const attachment = event.attachments.find((candidate) => candidate.id === attachmentId);
  if (!attachment || attachment.kind !== "file") {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }
  if (
    attachment.storage_bucket !== EVENT_ATTACHMENT_BUCKET ||
    !isCalendarEventStoragePath(event.workspace_id, event.id, attachment.storage_path)
  ) {
    return NextResponse.json({ error: "Event attachment storage is invalid" }, { status: 409 });
  }

  const { data, error } = await getSupabaseAdminClient()
    .storage.from(EVENT_ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.storage_path!, 60, { download: attachment.name });
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Event file is temporarily unavailable" }, { status: 503 });
  }
  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const dynamic = "force-dynamic";
export const GET = withErrorReporting(
  "api:calendar/events/attachment/download:GET",
  GET_handler,
);
