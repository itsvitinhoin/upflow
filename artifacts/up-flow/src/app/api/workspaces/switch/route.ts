import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

export async function POST(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const body = (await req.json().catch(() => ({}))) as { workspace_id?: string };
  const target = body.workspace_id;
  if (!target) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }
  if (!auth.memberships.some((m) => m.workspace_id === target)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = NextResponse.json({ success: true, workspace_id: target });
  res.cookies.set(WORKSPACE_COOKIE, target, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
