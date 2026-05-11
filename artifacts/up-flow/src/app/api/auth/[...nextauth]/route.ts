import { NextResponse } from "next/server";

// NextAuth replaced with Supabase Auth — stub to avoid 404s on stale requests.
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
