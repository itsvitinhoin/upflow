import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { previewImport } from "@/lib/clickup-import";
import { ClickUpError } from "@/lib/clickup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (auth.prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    team_id?: string;
  };
  const token = (body.token || process.env.CLICKUP_API_TOKEN || "").trim();
  const teamId = (body.team_id || "").trim();
  if (!token) return NextResponse.json({ error: "ClickUp token required" }, { status: 400 });
  if (!teamId) return NextResponse.json({ error: "team_id required" }, { status: 400 });

  try {
    const counts = await previewImport({ token, teamId });
    return NextResponse.json(counts);
  } catch (e) {
    const status = e instanceof ClickUpError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
