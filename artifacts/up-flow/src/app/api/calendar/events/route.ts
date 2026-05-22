import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { recordActivity } from "@/lib/activity";
import { parseDateParam } from "@/lib/time-range";

const EventSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  type: z.enum(["meeting", "task", "reminder", "deadline"]).default("meeting"),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  attendee_ids: z.array(z.string().uuid()).optional(),
  location: z.string().trim().optional().nullable(),
  meeting_url: z.string().trim().url().optional().nullable(),
  color: z.string().trim().optional().nullable(),
});

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const { searchParams } = new URL(req.url);
  const from = parseDateParam(searchParams.get("from"));
  const to = parseDateParam(searchParams.get("to"));

  const items = await prisma.calendarEvent.findMany({
    where: {
      workspace_id: auth.currentWorkspaceId,
      ...(from || to
        ? {
            starts_at: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ starts_at: "asc" }, { id: "asc" }],
    include: {
      creator: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
      attendees: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { created_at: "asc" },
      },
    },
  });

  return NextResponse.json({ items, nextCursor: null });
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  const parsed = EventSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const startsAt = new Date(body.starts_at);
  const endsAt = body.ends_at ? new Date(body.ends_at) : null;
  if (endsAt && endsAt <= startsAt) {
    return NextResponse.json({ error: "ends_at must be after starts_at" }, { status: 400 });
  }

  if (body.project_id) {
    const project = await prisma.project.findFirst({
      where: { id: body.project_id, workspace_id: auth.currentWorkspaceId },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
  }

  if (body.task_id) {
    const task = await prisma.task.findFirst({
      where: { id: body.task_id, project: { workspace_id: auth.currentWorkspaceId } },
      select: { id: true, project_id: true },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 400 });
  }

  const attendeeIds = Array.from(new Set(body.attendee_ids ?? []));
  if (attendeeIds.length > 0) {
    const members = await prisma.workspaceMember.findMany({
      where: { workspace_id: auth.currentWorkspaceId, user_id: { in: attendeeIds } },
      select: { user_id: true },
    });
    if (members.length !== attendeeIds.length) {
      return NextResponse.json({ error: "All attendees must be workspace members" }, { status: 400 });
    }
  }

  const event = await prisma.calendarEvent.create({
    data: {
      workspace_id: auth.currentWorkspaceId,
      title: body.title,
      description: body.description || null,
      type: body.type,
      starts_at: startsAt,
      ends_at: endsAt,
      timezone: body.timezone || "America/Sao_Paulo",
      created_by: auth.prismaUser.id,
      project_id: body.project_id || null,
      task_id: body.task_id || null,
      location: body.location || null,
      meeting_url: body.meeting_url || null,
      color: body.color || null,
      attendees: {
        create: attendeeIds.map((user_id) => ({ user_id })),
      },
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      attendees: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  await recordActivity({
    workspace_id: auth.currentWorkspaceId,
    actor_id: auth.prismaUser.id,
    type: "calendar_event_created",
    entity_type: "calendar_event",
    entity_id: event.id,
    project_id: event.project_id,
    task_id: event.task_id,
    metadata: { title: event.title, starts_at: event.starts_at.toISOString() },
  });

  return NextResponse.json(event, { status: 201 });
}

export const GET = withErrorReporting("api:calendar/events:GET", GET_handler);
export const POST = withErrorReporting("api:calendar/events:POST", POST_handler);
