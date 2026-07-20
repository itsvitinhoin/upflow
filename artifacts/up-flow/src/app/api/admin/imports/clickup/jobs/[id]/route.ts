import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { requireWorkspaceAdmin } from "@/lib/api/scope";
import { prisma } from "@/lib/prisma";
import { getImportedClickupSpaces } from "@/lib/clickup-import";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function handler(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const r = await requireAuth();
  if (!r.ok) return r.response;
  const a = requireWorkspaceAdmin(r.auth, r.auth.currentWorkspaceId);
  if (!a.ok) return a.response;

  const job = await prisma.importJob.findFirst({
    where: { id: params.id, workspace_id: r.auth.currentWorkspaceId },
    include: { mappings: { where: { status: "failed" }, take: 100 } },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...job,
    imported_spaces:
      job.status === "completed" ? await getImportedClickupSpaces(job) : [],
  });
}

export const GET = withErrorReporting("api:admin:imports:clickup:job:GET", handler);
