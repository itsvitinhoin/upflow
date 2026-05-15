import { NextResponse } from "next/server";
import { getAuthResult, type AuthUser, type AuthResult } from "@/lib/auth-helpers";

// NOTE: every helper below returns a *fresh* `NextResponse` per call.
// `NextResponse` wraps a request-scoped body stream that can only be read
// once, so reusing a module-level instance across requests can produce
// "body already consumed / locked" failures under load. Always construct
// a new one.

export const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export const serviceUnavailable = () =>
  NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });

export function authErrorResponse(r: Exclude<AuthResult, { kind: "ok" }>) {
  return r.kind === "anonymous" ? unauthorized() : serviceUnavailable();
}

export async function requireAuth(): Promise<
  { ok: true; auth: AuthUser } | { ok: false; response: NextResponse }
> {
  const r = await getAuthResult();
  if (r.kind === "ok") return { ok: true, auth: r.user };
  return { ok: false, response: authErrorResponse(r) };
}
