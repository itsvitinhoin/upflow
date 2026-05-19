import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastNotification } from "@/lib/supabase-server";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

// How far in the future "due soon" reaches. We use a single 24-hour window
// (see task #60). Tasks whose due_date falls between now and now+24h get one
// `due_soon` notification per (task, due_date) pair, deduped against any
// existing unread `due_soon` for that same task+due_date.
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // If no secret is configured, allow only when running on localhost (dev).
  if (!secret) {
    const host = req.headers.get("host") ?? "";
    return host.startsWith("localhost") || host.startsWith("127.0.0.1");
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  // Some schedulers send the secret as a custom header instead.
  if (req.headers.get("x-cron-secret") === secret) return true;
  return false;
}

async function handler(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

  // Only assigned, not-yet-done tasks need reminders.
  const tasks = await prisma.task.findMany({
    where: {
      due_date: { gte: now, lte: windowEnd },
      assignee_id: { not: null },
      status: { not: "done" },
    },
    select: {
      id: true,
      title: true,
      due_date: true,
      assignee_id: true,
    },
  });

  let created = 0;
  for (const task of tasks) {
    if (!task.assignee_id || !task.due_date) continue;

    // De-dupe: skip if an unread due_soon notification already exists for
    // this exact (task, due_date). We match on `data.due_date` directly in
    // the query so prior reminders for a different (rescheduled) due date
    // don't accidentally block today's reminder, and so multiple historical
    // rows can't hide a matching one from `findFirst`.
    const dueIso = task.due_date.toISOString();
    const existing = await prisma.notification.findFirst({
      where: {
        type: "due_soon",
        user_id: task.assignee_id,
        task_id: task.id,
        read: false,
        data: { path: ["due_date"], equals: dueIso },
      },
      select: { id: true },
    });
    if (existing) continue;

    try {
      await prisma.notification.create({
        data: {
          type: "due_soon",
          user_id: task.assignee_id,
          task_id: task.id,
          data: { due_date: dueIso, task_title: task.title },
        },
      });
      await broadcastNotification(task.assignee_id);
      created += 1;
    } catch (err) {
      logError("api:cron:due-soon:create", err, { task_id: task.id });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: tasks.length,
    created,
    window_hours: DUE_SOON_WINDOW_MS / 3_600_000,
    ran_at: now.toISOString(),
  });
}

export const GET = withErrorReporting("api:cron:due-soon:GET", handler);
export const POST = withErrorReporting("api:cron:due-soon:POST", handler);
