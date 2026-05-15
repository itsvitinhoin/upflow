import { NextResponse } from "next/server";
import { getAuthResult, type AuthUser, type AuthResult } from "@/lib/auth-helpers";

export const UNAUTHORIZED = NextResponse.json(
  { error: "Unauthorized" },
  { status: 401 },
);

export const SERVICE_UNAVAILABLE = NextResponse.json(
  { error: "Service temporarily unavailable" },
  { status: 503 },
);

export function authErrorResponse(r: Exclude<AuthResult, { kind: "ok" }>) {
  return r.kind === "anonymous" ? UNAUTHORIZED : SERVICE_UNAVAILABLE;
}

export async function requireAuth(): Promise<
  { ok: true; auth: AuthUser } | { ok: false; response: NextResponse }
> {
  const r = await getAuthResult();
  if (r.kind === "ok") return { ok: true, auth: r.user };
  return { ok: false, response: authErrorResponse(r) };
}
