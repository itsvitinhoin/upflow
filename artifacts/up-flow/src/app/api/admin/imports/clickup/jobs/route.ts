import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-response";
import { requireWorkspaceAdmin } from "@/lib/api/scope";
import { prisma } from "@/lib/prisma";
import { getImportedClickupSpaces } from "@/lib/clickup-import";
import { withErrorReporting } from "@/lib/with-error-reporting";
const sourceSelection = z.object({
  space_id: z.string(),
  space_name: z.string().min(1).optional(),
  folder_id: z.string().optional(),
  folder_name: z.string().min(1).optional(),
  list_id: z.string(),
  list_name: z.string().min(1).optional(),
});

const body = z.object({
  source_workspace_id: z.string().min(1),
  selected_source_ids: z.array(sourceSelection).min(1),
  confirmation: z.literal(true),
});
async function post(req: NextRequest) {
  const r = await requireAuth();
  if (!r.ok) return r.response;
  const a = requireWorkspaceAdmin(r.auth, r.auth.currentWorkspaceId);
  if (!a.ok) return a.response;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const active = await prisma.importJob.findFirst({
    where: {
      workspace_id: r.auth.currentWorkspaceId,
      status: { in: ["queued", "running", "paused"] },
    },
  });
  if (active) {
    return NextResponse.json(
      { error: "An import is already running for this workspace" },
      { status: 409 },
    );
  }

  const job = await prisma.importJob.create({
    data: {
      workspace_id: r.auth.currentWorkspaceId,
      source_workspace_id: parsed.data.source_workspace_id,
      selected_source_ids: parsed.data.selected_source_ids,
      total: parsed.data.selected_source_ids.length,
      created_by: r.auth.prismaUser.id,
      status: "queued",
    },
  });
  return NextResponse.json(job, { status: 201 });
}

async function get(_req: NextRequest) {
  const r = await requireAuth();
  if (!r.ok) return r.response;
  const a = requireWorkspaceAdmin(r.auth, r.auth.currentWorkspaceId);
  if (!a.ok) return a.response;

  const jobs = await prisma.importJob.findMany({
    where: { workspace_id: r.auth.currentWorkspaceId },
    orderBy: { created_at: "desc" },
    take: 20,
  });
  const items = await Promise.all(
    jobs.map(async (job) => ({
      ...job,
      imported_spaces:
        job.status === "completed" ? await getImportedClickupSpaces(job) : [],
    })),
  );
  return NextResponse.json({ items });
}
export const POST = withErrorReporting("api:admin:imports:clickup:jobs:POST", post);
export const GET = withErrorReporting("api:admin:imports:clickup:jobs:GET", get);
