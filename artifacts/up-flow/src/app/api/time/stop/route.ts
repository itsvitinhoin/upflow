import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { secondsBetween } from "@/lib/time-range";
import { recordActivity } from "@/lib/activity";

const StopSchema = z.object({
  id: z.string().uuid().optional(),
});

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

  const parsed = StopSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid timer", issues: parsed.error.flatten() }, { status: 400 });
  }

  const entry = parsed.data.id
    ? await prisma.timeEntry.findUnique({ where: { id: parsed.data.id } })
    : await prisma.timeEntry.findFirst({
        where: {
          workspace_id: auth.currentWorkspaceId,
          user_id: auth.prismaUser.id,
          status: "running",
        },
        orderBy: { started_at: "desc" },
      });

  if (!entry) return NextResponse.json({ error: "No running timer" }, { status: 404 });
  if (entry.workspace_id !== auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (entry.status === "stopped") return NextResponse.json(entry);

  const stoppedAt = new Date();
  const updated = await prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      stopped_at: stoppedAt,
      duration_seconds: secondsBetween(entry.started_at, stoppedAt),
      status: "stopped",
    },
    include: {
      project: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  await recordActivity({
    workspace_id: entry.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "time_entry_stopped",
    entity_type: "time_entry",
    entity_id: entry.id,
    project_id: entry.project_id,
    task_id: entry.task_id,
    metadata: { duration_seconds: updated.duration_seconds },
  });

  return NextResponse.json(updated);
}

export const POST = withErrorReporting("api:time/stop:POST", POST_handler);
