import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { parseDateParam, secondsBetween } from "@/lib/time-range";
import { recordActivity } from "@/lib/activity";
import { validateProjectTask } from "@/lib/time-entries";

const ManualEntrySchema = z.object({
  project_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  started_at: z.string().datetime(),
  stopped_at: z.string().datetime().optional().nullable(),
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
  const requestedUserId = searchParams.get("user_id");
  const userId =
    requestedUserId && isWorkspaceAdminFor(auth, auth.currentWorkspaceId)
      ? requestedUserId
      : auth.prismaUser.id;

  const items = await prisma.timeEntry.findMany({
    where: {
      workspace_id: auth.currentWorkspaceId,
      user_id: userId,
      ...(from || to
        ? {
            started_at: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ started_at: "desc" }, { id: "asc" }],
    take: 500,
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true } },
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

  const parsed = ManualEntrySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid time entry", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const startedAt = new Date(body.started_at);
  const stoppedAt = body.stopped_at ? new Date(body.stopped_at) : null;
  if (stoppedAt && stoppedAt <= startedAt) {
    return NextResponse.json({ error: "stopped_at must be after started_at" }, { status: 400 });
  }

  const invalid = await validateProjectTask({
    workspaceId: auth.currentWorkspaceId,
    projectId: body.project_id,
    taskId: body.task_id,
  });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (!stoppedAt) {
    const existing = await prisma.timeEntry.findFirst({
      where: {
        workspace_id: auth.currentWorkspaceId,
        user_id: auth.prismaUser.id,
        status: "running",
      },
      orderBy: { started_at: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    });
    if (existing) return NextResponse.json(existing, { status: 200 });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      workspace_id: auth.currentWorkspaceId,
      user_id: auth.prismaUser.id,
      project_id: body.project_id || null,
      task_id: body.task_id || null,
      description: body.description || null,
      started_at: startedAt,
      stopped_at: stoppedAt,
      duration_seconds: stoppedAt ? secondsBetween(startedAt, stoppedAt) : 0,
      status: stoppedAt ? "stopped" : "running",
    },
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  await recordActivity({
    workspace_id: auth.currentWorkspaceId,
    actor_id: auth.prismaUser.id,
    type: entry.status === "running" ? "time_entry_started" : "time_entry_logged",
    entity_type: "time_entry",
    entity_id: entry.id,
    project_id: entry.project_id,
    task_id: entry.task_id,
    metadata: { description: entry.description, duration_seconds: entry.duration_seconds },
  });

  return NextResponse.json(entry, { status: 201 });
}

export const GET = withErrorReporting("api:time/entries:GET", GET_handler);
export const POST = withErrorReporting("api:time/entries:POST", POST_handler);
