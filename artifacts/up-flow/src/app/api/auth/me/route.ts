import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = auth.prismaUser;
  return NextResponse.json({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    image: u.avatar_url ?? null,
  });
}
