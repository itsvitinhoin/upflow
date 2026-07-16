import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { requireWorkspaceAdmin } from "@/lib/api/scope";
import { prisma } from "@/lib/prisma";
import { withErrorReporting } from "@/lib/with-error-reporting";
async function handler(_req: Request, { params }: { params: { id: string } }) { const r = await requireAuth(); if (!r.ok) return r.response; const a = requireWorkspaceAdmin(r.auth, r.auth.currentWorkspaceId); if (!a.ok) return a.response; const result = await prisma.importJob.updateMany({ where: { id: params.id, workspace_id: r.auth.currentWorkspaceId, status: { in: ["queued", "running", "paused"] } }, data: { status: "cancelled", completed_at: new Date() } }); return result.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found or already finished" }, { status: 404 }); }
export const POST = withErrorReporting("api:admin:imports:clickup:cancel:POST", handler);
