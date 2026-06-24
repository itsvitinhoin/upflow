import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { validateProjectTask } from "@/lib/time-entries";
import { recordActivity } from "@/lib/activity";

const StartSchema = z.object({
  project_id: z.string().uuid().optional().nullable(),
  task_id: z.string().uuid().optional().nullable(),
  description: z.string().trim().optional().nullable(),
});

const runningEntryInclude = {
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
} satisfies Prisma.TimeEntryInclude;

function findRunningEntry(workspaceId: string, userId: string) {
  return prisma.timeEntry.findFirst({
    where: {
      workspace_id: workspaceId,
      user_id: userId,
      status: "running",
    },
    orderBy: { started_at: "desc" },
    include: runningEntryInclude,
  });
}

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

  const parsed = StartSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid timer", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const invalid = await validateProjectTask({
    workspaceId: auth.currentWorkspaceId,
    projectId: body.project_id,
    taskId: body.task_id,
  });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const existing = await findRunningEntry(auth.currentWorkspaceId, auth.prismaUser.id);
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  let entry;
  try {
    entry = await prisma.timeEntry.create({
      data: {
        workspace_id: auth.currentWorkspaceId,
        user_id: auth.prismaUser.id,
        project_id: body.project_id || null,
        task_id: body.task_id || null,
        description: body.description || null,
        started_at: new Date(),
        status: "running",
      },
      include: runningEntryInclude,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const running = await findRunningEntry(auth.currentWorkspaceId, auth.prismaUser.id);
      if (running) return NextResponse.json(running, { status: 200 });
    }
    throw err;
  }

  await recordActivity({
    workspace_id: auth.currentWorkspaceId,
    actor_id: auth.prismaUser.id,
    type: "time_entry_started",
    entity_type: "time_entry",
    entity_id: entry.id,
    project_id: entry.project_id,
    task_id: entry.task_id,
    metadata: { description: entry.description },
  });

  return NextResponse.json(entry, { status: 201 });
}

export const POST = withErrorReporting("api:time/start:POST", POST_handler);
