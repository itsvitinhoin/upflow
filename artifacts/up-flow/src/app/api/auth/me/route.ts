import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const u = auth.prismaUser;
  return NextResponse.json({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    image: u.avatar_url ?? null,
  });
}
export const GET = withErrorReporting("api:auth/me:GET", GET_handler);
