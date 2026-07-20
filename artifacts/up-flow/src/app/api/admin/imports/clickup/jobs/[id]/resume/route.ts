import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { requireWorkspaceAdmin } from "@/lib/api/scope";
import { prisma } from "@/lib/prisma";
import { runClickupBatch } from "@/lib/clickup-import";
import { withErrorReporting } from "@/lib/with-error-reporting";
async function handler(_req: Request, { params }: { params: { id: string } }) { const r = await requireAuth(); if (!r.ok) return r.response; const a = requireWorkspaceAdmin(r.auth, r.auth.currentWorkspaceId); if (!a.ok) return a.response; const job = await prisma.importJob.findFirst({ where: { id: params.id, workspace_id: r.auth.currentWorkspaceId } }); if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 }); if (job.status === "cancelled") return NextResponse.json({ error: "Import cancelled" }, { status: 409 }); if (job.status === "completed") return NextResponse.json({ error: "Import already completed" }, { status: 409 }); await prisma.importJob.update({ where: { id: job.id }, data: { status: "running", started_at: job.started_at ?? new Date() } }); const updated = await runClickupBatch(job.id, r.auth.prismaUser.id); return NextResponse.json(updated); }
export const POST = withErrorReporting("api:admin:imports:clickup:resume:POST", handler);
