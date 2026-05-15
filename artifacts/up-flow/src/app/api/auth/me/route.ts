import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";

export async function GET() {
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
