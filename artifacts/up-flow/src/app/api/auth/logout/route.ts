import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEST_AUTH_COOKIE } from "@/lib/test-auth";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function POST_handler() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  const res = NextResponse.json({ ok: true });
  // Also clear the dev/CI test-login cookie — supabase.signOut() doesn't
  // know about it, and leaving it behind would keep a session "logged in"
  // from the bypass channel after the user thinks they logged out.
  res.cookies.set({
    name: TEST_AUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
export const POST = withErrorReporting("api:auth/logout:POST", POST_handler);
