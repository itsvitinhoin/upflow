import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { getTeams, ClickUpError } from "@/lib/clickup";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
