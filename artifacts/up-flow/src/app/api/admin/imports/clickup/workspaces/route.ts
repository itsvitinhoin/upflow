import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { requireWorkspaceAdmin } from "@/lib/api/scope";
import { clickupWorkspaces } from "@/lib/clickup";
import { withErrorReporting } from "@/lib/with-error-reporting";
async function handler() { const r = await requireAuth(); if (!r.ok) return r.response; const a = requireWorkspaceAdmin(r.auth, r.auth.currentWorkspaceId); if (!a.ok) return a.response; return NextResponse.json(await clickupWorkspaces()); }
export const GET = withErrorReporting("api:admin:imports:clickup:workspaces:GET", handler);
