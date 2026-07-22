import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { withErrorReporting } from "@/lib/with-error-reporting";
import {
  canManageCalendarEvent,
  cleanCalendarEventFileName,
  EVENT_ATTACHMENT_BUCKET,
  loadCalendarEventDetail,
  serializeCalendarEventAttachment,
} from "../../event-detail";

const MAX_EVENT_FILE_BYTES = 25_000_000;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const JsonAttachmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("link"),
    url: z.string().trim().url().max(2_000),
    name: z.string().trim().min(1).max(255).optional(),
  }),
  z.object({
    kind: z.literal("document"),
    document_id: z.string().uuid(),
    name: z.string().trim().min(1).max(255).optional(),
  }),
]);

type RouteContext = { params: Promise<{ id: string }> };

function isHttpUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

async function loadManagedEvent(id: string) {
  const _r = await requireAuth();
  if (!_r.ok) return _r;
  const event = await loadCalendarEventDetail(id);
  if (!event || !canAccessWorkspace(_r.auth, event.workspace_id)) {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  if (!(await canManageCalendarEvent(_r.auth, event))) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, auth: _r.auth, event };
}

async function GET_handler(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const event = await loadCalendarEventDetail(id);
  if (!event || !canAccessWorkspace(_r.auth, event.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  void req;
  return NextResponse.json({
    items: event.attachments.map((attachment) => serializeCalendarEventAttachment(attachment, event.id)),
  });
}

async function POST_handler(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const managed = await loadManagedEvent(id);
  if (!managed.ok) return managed.response;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const parsed = JsonAttachmentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid attachment", issues: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;
    if (body.kind === "link") {
      if (!isHttpUrl(body.url)) {
        return NextResponse.json({ error: "Only HTTP(S) links can be attached" }, { status: 400 });
      }
      const attachment = await prisma.calendarEventAttachment.create({
        data: {
          event_id: managed.event.id,
          kind: "link",
          name: body.name || new URL(body.url).hostname,
          url: body.url,
          created_by: managed.auth.prismaUser.id,
        },
        include: { document: { select: { id: true, title: true, project_id: true } } },
      });
      return NextResponse.json(serializeCalendarEventAttachment(attachment, managed.event.id), { status: 201 });
    }

    const document = await prisma.doc.findFirst({
      where: { id: body.document_id, workspace_id: managed.event.workspace_id },
      select: { id: true, title: true },
    });
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 400 });
    const attachment = await prisma.calendarEventAttachment.create({
      data: {
        event_id: managed.event.id,
        kind: "document",
        name: body.name || document.title,
        document_id: document.id,
        created_by: managed.auth.prismaUser.id,
      },
      include: { document: { select: { id: true, title: true, project_id: true } } },
    });
    return NextResponse.json(serializeCalendarEventAttachment(attachment, managed.event.id), { status: 201 });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return NextResponse.json(
      { error: "Private event attachment storage is not configured", code: "EVENT_STORAGE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Provide a file or a JSON link/document attachment" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_EVENT_FILE_BYTES) {
    return NextResponse.json({ error: "Event files must be between 1 byte and 25 MB" }, { status: 400 });
  }
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported event attachment file type" }, { status: 400 });
  }

  const fileName = cleanCalendarEventFileName(file.name);
  const path = [
    managed.event.workspace_id,
    "calendar-events",
    managed.event.id,
    `${Date.now()}-${randomUUID()}-${fileName}`,
  ].join("/");
  const bytes = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage.from(EVENT_ATTACHMENT_BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: "Could not upload the private event file" }, { status: 503 });
  }

  try {
    const attachment = await prisma.calendarEventAttachment.create({
      data: {
        event_id: managed.event.id,
        kind: "file",
        name: fileName,
        storage_bucket: EVENT_ATTACHMENT_BUCKET,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        created_by: managed.auth.prismaUser.id,
      },
      include: { document: { select: { id: true, title: true, project_id: true } } },
    });
    return NextResponse.json(serializeCalendarEventAttachment(attachment, managed.event.id), { status: 201 });
  } catch (error) {
    await supabase.storage.from(EVENT_ATTACHMENT_BUCKET).remove([path]);
    throw error;
  }
}

export const GET = withErrorReporting("api:calendar/events/attachments:GET", GET_handler);
export const POST = withErrorReporting("api:calendar/events/attachments:POST", POST_handler);
