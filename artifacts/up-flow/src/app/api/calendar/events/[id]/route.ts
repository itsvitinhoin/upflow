import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, isWorkspaceAdminFor, type AuthUser } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { recordActivity } from "@/lib/activity";
import { notifyCalendarEventAssignees } from "@/lib/calendar-notifications";

const UpdateEventSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  type: z.enum(["meeting", "task", "reminder", "deadline"]).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  attendee_ids: z.array(z.string().uuid()).optional(),
  location: z.string().trim().optional().nullable(),
  meeting_url: z.string().trim().url().optional().nullable(),
  color: z.string().trim().optional().nullable(),
});

async function loadEvent(id: string) {
  return prisma.calendarEvent.findUnique({
    where: { id },
    include: {
      attendees: { select: { user_id: true } },
      creator: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });
}

function canManageEvent(
  auth: AuthUser,
  event: { workspace_id: string; created_by: string },
) {
  return isWorkspaceAdminFor(auth, event.workspace_id) || event.created_by === auth.prismaUser.id;
}

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const event = await loadEvent(params.id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, event.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(event);
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const existing = await loadEvent(params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, existing.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canManageEvent(auth, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = UpdateEventSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const startsAt = body.starts_at ? new Date(body.starts_at) : existing.starts_at;
  const endsAt =
    body.ends_at === undefined
      ? existing.ends_at
      : body.ends_at
        ? new Date(body.ends_at)
        : null;
  if (endsAt && endsAt <= startsAt) {
    return NextResponse.json({ error: "ends_at must be after starts_at" }, { status: 400 });
  }

  if (body.project_id) {
    const project = await prisma.project.findFirst({
      where: { id: body.project_id, workspace_id: existing.workspace_id },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
  }

  if (body.task_id) {
    const task = await prisma.task.findFirst({
      where: { id: body.task_id, project: { workspace_id: existing.workspace_id } },
      select: { id: true },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 400 });
  }

  const attendeeIds = body.attendee_ids
    ? Array.from(new Set(body.attendee_ids))
    : undefined;
  const previousAttendeeIds = new Set(
    existing.attendees.map((attendee) => attendee.user_id),
  );
  if (attendeeIds && attendeeIds.length > 0) {
    const members = await prisma.workspaceMember.findMany({
      where: { workspace_id: existing.workspace_id, user_id: { in: attendeeIds } },
      select: { user_id: true },
    });
    if (members.length !== attendeeIds.length) {
      return NextResponse.json({ error: "All attendees must be workspace members" }, { status: 400 });
    }
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.starts_at !== undefined && { starts_at: startsAt }),
      ...(body.ends_at !== undefined && { ends_at: endsAt }),
      ...(body.timezone !== undefined && { timezone: body.timezone || null }),
      ...(body.project_id !== undefined && { project_id: body.project_id || null }),
      ...(body.task_id !== undefined && { task_id: body.task_id || null }),
      ...(body.location !== undefined && { location: body.location || null }),
      ...(body.meeting_url !== undefined && { meeting_url: body.meeting_url || null }),
      ...(body.color !== undefined && { color: body.color || null }),
      ...(attendeeIds && {
        attendees: {
          deleteMany: {},
          create: attendeeIds.map((user_id) => ({ user_id })),
        },
      }),
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      attendees: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  await recordActivity({
    workspace_id: existing.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "calendar_event_updated",
    entity_type: "calendar_event",
    entity_id: updated.id,
    project_id: updated.project_id,
    task_id: updated.task_id,
    metadata: { title: updated.title },
  });

  if (attendeeIds) {
    const newlyAddedAttendees = attendeeIds.filter(
      (userId) => !previousAttendeeIds.has(userId),
    );
    await notifyCalendarEventAssignees({
      event: updated,
      attendeeIds: newlyAddedAttendees,
      actor: auth.prismaUser,
    });
  }

  return NextResponse.json(updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const existing = await loadEvent(params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, existing.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canManageEvent(auth, existing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.calendarEvent.delete({ where: { id: params.id } });
  await recordActivity({
    workspace_id: existing.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "calendar_event_deleted",
    entity_type: "calendar_event",
    entity_id: existing.id,
    project_id: existing.project_id,
    task_id: existing.task_id,
    metadata: { title: existing.title },
  });

  return NextResponse.json({ success: true });
}

export const GET = withErrorReporting("api:calendar/events/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:calendar/events/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:calendar/events/id:DELETE", DELETE_handler);
