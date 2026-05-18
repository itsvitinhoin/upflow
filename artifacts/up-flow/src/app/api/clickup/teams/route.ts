import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { getTeams, ClickUpError } from "@/lib/clickup";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { logError } from "@/lib/log-error";

export const dynamic = "force-dynamic";

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (auth.prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = (body.token || process.env.CLICKUP_API_TOKEN || "").trim();
  if (!token) return NextResponse.json({ error: "ClickUp token required" }, { status: 400 });

  try {
    const teams = await getTeams({ token });
    return NextResponse.json({
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
    });
  } catch (e) {
    const status = e instanceof ClickUpError ? e.status : 500;
    // See api/clickup/preview for rationale: only forward true 5xx to the
    // tracker so we capture root cause without doubling up on 4xx (bad
    // token, etc.) that the user fixes themselves.
    if (status >= 500) logError("api:clickup/teams:POST", e);
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
export const POST = withErrorReporting("api:clickup/teams:POST", POST_handler);
