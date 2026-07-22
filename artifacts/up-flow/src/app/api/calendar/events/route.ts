import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdminFor, type AuthUser } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { recordActivity } from "@/lib/activity";
import { parseDateParam } from "@/lib/time-range";
import { notifyCalendarEventAssignees } from "@/lib/calendar-notifications";
import { recomputeOnboardingProgress } from "@/lib/onboarding";
import {
  calendarEventDetailInclude,
  serializeCalendarEvent,
  validateCalendarEventRelations,
} from "./event-detail";

const EventSchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(50_000).optional().nullable(),
  type: z.enum(["meeting", "client_call", "internal_meeting", "task", "reminder", "deadline"]).default("meeting"),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().max(100).optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  company_id: z.string().uuid().optional().nullable(),
  space_id: z.string().uuid().optional().nullable(),
  responsible_user_id: z.string().uuid().optional().nullable(),
  attendee_ids: z.array(z.string().uuid()).max(200).optional(),
  reminder_minutes: z.array(z.number().int().min(1).max(525_600)).max(20).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  location: z.string().trim().max(1_000).optional().nullable(),
  meeting_url: z.string().trim().url().max(2_000).optional().nullable(),
  color: z.string().trim().optional().nullable(),
});

function isSchedulingText(value: string) {
  const text = value.toLowerCase();
  return (
    text.includes("schedule") ||
    text.includes("meeting") ||
    text.includes("reuni") ||
    text.includes("visita") ||
    text.includes("agenda")
  );
}

async function canCreateCalendarEvent(auth: AuthUser, workspaceId: string) {
  if (isWorkspaceAdminFor(auth, workspaceId)) return true;

  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspace_id: workspaceId,
      user_id: auth.prismaUser.id,
      status: "active",
      role: { not: "guest" },
    },
    select: { id: true },
  });

  return Boolean(member);
}

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
    include: calendarEventDetailInclude,
  });

  return NextResponse.json({ items: items.map(serializeCalendarEvent), nextCursor: null });
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

  const linkedTask = body.task_id
    ? await prisma.task.findFirst({
        where: { id: body.task_id, project: { workspace_id: auth.currentWorkspaceId } },
        select: {
          id: true,
          title: true,
          project_id: true,
          assignee_id: true,
          project: { select: { id: true, workspace_id: true, owner_id: true } },
        },
      })
    : null;
  if (body.task_id && !linkedTask) return NextResponse.json({ error: "Task not found" }, { status: 400 });

  const linkedSchedulingItem = linkedTask
    ? await prisma.onboardingChecklistItem.findFirst({
        where: { task_id: linkedTask.id },
        select: {
          id: true,
          onboarding_id: true,
          owner_id: true,
          department: true,
          title: true,
          status: true,
        },
      })
    : null;
  const isLinkedSchedulingItem = Boolean(
    linkedTask &&
      linkedSchedulingItem &&
      isSchedulingText(`${linkedSchedulingItem.department} ${linkedSchedulingItem.title} ${linkedTask.title}`),
  );

  const admin = isWorkspaceAdminFor(auth, auth.currentWorkspaceId);
  const canCreateLinkedSchedule = Boolean(
    linkedTask &&
      linkedSchedulingItem &&
      isLinkedSchedulingItem &&
      (linkedTask.assignee_id === auth.prismaUser.id ||
        linkedTask.project.owner_id === auth.prismaUser.id ||
        linkedSchedulingItem.owner_id === auth.prismaUser.id),
  );
  const canCreateWorkspaceEvent = await canCreateCalendarEvent(auth, auth.currentWorkspaceId);
  if (!canCreateWorkspaceEvent && !canCreateLinkedSchedule) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eventProjectId = body.project_id || linkedTask?.project_id || null;
  const attendeeIds = Array.from(new Set([
    ...(body.attendee_ids ?? []),
    ...(linkedTask?.assignee_id ? [linkedTask.assignee_id] : []),
    ...(body.responsible_user_id ? [body.responsible_user_id] : []),
  ]));
  const reminderMinutes = Array.from(new Set(body.reminder_minutes ?? [])).sort((a, b) => a - b);
  const relationValidation = await validateCalendarEventRelations({
    workspaceId: auth.currentWorkspaceId,
    projectId: eventProjectId,
    taskId: body.task_id || null,
    companyId: body.company_id || null,
    spaceId: body.space_id || null,
    responsibleUserId: body.responsible_user_id || null,
    attendeeIds,
  });
  if (!relationValidation.ok) {
    return NextResponse.json({ error: relationValidation.error }, { status: 400 });
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
      project_id: eventProjectId,
      task_id: body.task_id || null,
      company_id: body.company_id || null,
      space_id: body.space_id || null,
      responsible_user_id: body.responsible_user_id || null,
      priority: body.priority,
      location: body.location || null,
      meeting_url: body.meeting_url || null,
      color: body.color || null,
      attendees: { create: attendeeIds.map((user_id) => ({ user_id })) },
      reminders: { create: reminderMinutes.map((minutes_before) => ({ minutes_before })) },
    },
    include: calendarEventDetailInclude,
  });

  await recordActivity({
    workspace_id: auth.currentWorkspaceId,
    actor_id: auth.prismaUser.id,
    type: "calendar_event_created",
    entity_type: "calendar_event",
    entity_id: event.id,
    project_id: event.project_id,
    task_id: event.task_id,
    company_id: event.company_id,
    metadata: { title: event.title, starts_at: event.starts_at.toISOString(), type: event.type },
  });

  await notifyCalendarEventAssignees({
    event,
    attendeeIds,
    actor: auth.prismaUser,
  });

  if (linkedTask && linkedSchedulingItem && isLinkedSchedulingItem && (admin || canCreateLinkedSchedule)) {
    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: linkedTask.id },
        data: { status: "done" },
      });
      await tx.onboardingChecklistItem.update({
        where: { id: linkedSchedulingItem.id },
        data: {
          status: "complete",
          completed_at: new Date(),
          completed_by: auth.prismaUser.id,
        },
      });
      await tx.onboardingMeeting.updateMany({
        where: { checklist_item_id: linkedSchedulingItem.id },
        data: {
          scheduled: true,
          scheduled_at: startsAt,
          meeting_url: body.meeting_url || null,
          notes: body.description || null,
        },
      });
      await recomputeOnboardingProgress(tx, linkedSchedulingItem.onboarding_id);
    });
  }

  return NextResponse.json(serializeCalendarEvent(event), { status: 201 });
}

export const GET = withErrorReporting("api:calendar/events:GET", GET_handler);
export const POST = withErrorReporting("api:calendar/events:POST", POST_handler);
