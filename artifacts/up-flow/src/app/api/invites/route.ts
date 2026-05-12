import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";

// Stub endpoint: validates and returns success.
// Real email sending is tracked in another task.
export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { emails?: string[]; role?: string };
  const emails = (body.emails || []).map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) {
    return NextResponse.json({ error: "At least one email is required" }, { status: 400 });
  }
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const invalid = emails.filter((e) => !re.test(e));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid email: ${invalid[0]}` }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    sent: emails.length,
    role: body.role || "member",
  });
}
