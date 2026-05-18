import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, { windowMs: 60_000, max: 10, key: "login" });
  if (!rl.ok) return rateLimitResponse(rl);
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (!data.session) {
      return NextResponse.json({ error: "No session created" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export const POST = withErrorReporting("api:auth/login:POST", POST_handler);
