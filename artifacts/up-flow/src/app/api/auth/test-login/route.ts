import { NextRequest, NextResponse } from "next/server";
import {
  TEST_AUTH_COOKIE,
  isTestLoginEnabled,
  signTestAuthCookie,
} from "@/lib/test-auth";

// Hide the route entirely in production builds — `isTestLoginEnabled()`
// also rejects, but this avoids even compiling the handler when off.
export const dynamic = "force-dynamic";

/**
 * Dev/CI-only login bypass. Disabled in production AND when `TEST_LOGIN_TOKEN`
 * is unset. Posts `{ email, token }` — token must match the env var. On
 * success, sets a signed httpOnly cookie that `getAuthResult()` and the
 * middleware recognize. Used by the Playwright suite (see `tests/`).
 */
export async function POST(req: NextRequest) {
  if (!isTestLoginEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    token?: string;
  };

  if (!body.email || !body.token) {
    return NextResponse.json(
      { error: "email and token are required" },
      { status: 400 },
    );
  }
  if (body.token !== process.env.TEST_LOGIN_TOKEN) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const signed = await signTestAuthCookie(body.email);
  if (!signed) {
    return NextResponse.json({ error: "Test login disabled" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: TEST_AUTH_COOKIE,
    value: signed,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });
  return res;
}
