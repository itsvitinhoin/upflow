import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-response";
import { requireWorkspaceAdmin } from "@/lib/api/scope";
import { clickupHierarchy } from "@/lib/clickup-import";
import { checkRateLimit } from "@/lib/rate-limit";
import { withErrorReporting } from "@/lib/with-error-reporting";
const body = z.object({ source_workspace_id: z.string().min(1) });
async function handler(req: NextRequest) { const r = await requireAuth(); if (!r.ok) return r.response; const a = requireWorkspaceAdmin(r.auth, r.auth.currentWorkspaceId); if (!a.ok) return a.response; const limit = await checkRateLimit(req, { key: "clickup-import", windowMs: 60_000, max: 20 }); if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 }); const parsed = body.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 }); return NextResponse.json({ items: await clickupHierarchy(parsed.data.source_workspace_id) }); }
export const POST = withErrorReporting("api:admin:imports:clickup:hierarchy:POST", handler);
