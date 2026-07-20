import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { requireWorkspaceAdmin } from "@/lib/api/scope";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  beginClickupStatusSync,
  getImportedClickupSpaces,
  runClickupStatusSync,
} from "@/lib/clickup-import";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const r = await requireAuth();
  if (!r.ok) return r.response;
  const a = requireWorkspaceAdmin(r.auth, r.auth.currentWorkspaceId);
  if (!a.ok) return a.response;
  const limit = await checkRateLimit(req, {
    key: "clickup-import-status-sync",
    windowMs: 60_000,
    max: 4,
  });
  if (!limit.ok) return rateLimitResponse(limit);

  const job = await prisma.importJob.findFirst({
    where: { id: params.id, workspace_id: r.auth.currentWorkspaceId },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "completed") {
    return NextResponse.json(
      { error: "Wait for the migration to finish before synchronizing statuses" },
      { status: 409 },
    );
  }

  const started = await prisma.importJob.updateMany({
    where: {
      id: job.id,
      workspace_id: r.auth.currentWorkspaceId,
      status: "completed",
    },
    data: {
      status: "running",
      cursor: 0,
      completed_at: null,
      report: beginClickupStatusSync(job.report),
    },
  });
  if (!started.count) {
    return NextResponse.json(
      { error: "A status synchronization is already running" },
      { status: 409 },
    );
  }

  const updated = await runClickupStatusSync(job.id);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...updated,
    imported_spaces:
      updated.status === "completed" ? await getImportedClickupSpaces(updated) : [],
  });
}

export const POST = withErrorReporting(
  "api:admin:imports:clickup:sync-statuses:POST",
  handler,
);
