import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { secondsBetween } from "@/lib/time-range";
import { recordActivity } from "@/lib/activity";

const PauseSchema = z.object({
  id: z.string().uuid().optional(),
});

const timeEntryInclude = {
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
} satisfies Prisma.TimeEntryInclude;

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }
  if (!isWorkspaceAdminFor(auth, auth.currentWorkspaceId)) {
    return NextResponse.json({ error: "Workspace admin access required" }, { status: 403 });
  }

  const parsed = PauseSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid timer", issues: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.timeEntry.findFirst({
    where: {
      workspace_id: auth.currentWorkspaceId,
      user_id: auth.prismaUser.id,
      ...(parsed.data.id ? { id: parsed.data.id } : { status: { not: "stopped" } }),
    },
    orderBy: { started_at: "desc" },
    include: timeEntryInclude,
  });

  if (!entry || entry.status === "stopped") {
    return NextResponse.json({ error: "No open timer" }, { status: 404 });
  }
  if (entry.status === "paused") return NextResponse.json(entry);

  const pausedAt = new Date();
  const durationSeconds =
    entry.duration_seconds + secondsBetween(entry.active_started_at ?? entry.started_at, pausedAt);
  const transitioned = await prisma.timeEntry.updateMany({
    where: {
      id: entry.id,
      workspace_id: auth.currentWorkspaceId,
      user_id: auth.prismaUser.id,
      status: "running",
    },
    data: {
      // Keep the latest segment's start so schedule views never paint the
      // paused gap as worked time. The accumulated total already includes
      // this segment, and resume replaces this value with its new start.
      paused_at: pausedAt,
      duration_seconds: durationSeconds,
      status: "paused",
    },
  });
  if (transitioned.count !== 1) {
    return NextResponse.json({ error: "Timer changed in another session" }, { status: 409 });
  }
  const updated = await prisma.timeEntry.findUnique({
    where: { id: entry.id },
    include: timeEntryInclude,
  });
  if (!updated) return NextResponse.json({ error: "No open timer" }, { status: 404 });

  await recordActivity({
    workspace_id: entry.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "time_entry_paused",
    entity_type: "time_entry",
    entity_id: entry.id,
    project_id: entry.project_id,
    task_id: entry.task_id,
    metadata: { duration_seconds: updated.duration_seconds },
  });

  return NextResponse.json(updated);
}

export const POST = withErrorReporting("api:time/pause:POST", POST_handler);
