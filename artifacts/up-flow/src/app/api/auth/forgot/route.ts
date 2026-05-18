import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { getEmailOrigin, EmailOriginError } from "@/lib/email/origin";
import { logError } from "@/lib/log-error";

/**
 * Kick off a password reset.
 *
 * We always respond 202 to avoid leaking which addresses have accounts —
 * standard practice for password-reset endpoints. The actual send happens
 * server-side via Resend; Supabase generates the action link with our
 * configured redirect.
 */
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req, { windowMs: 60_000, max: 5, key: "forgot" });
  if (!rl.ok) return rateLimitResponse(rl);

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  const NEUTRAL = NextResponse.json({ status: "accepted" }, { status: 202 });

  if (!email) return NEUTRAL;
  // Cheap shape check; full validation happens at Supabase.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NEUTRAL;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Without the service role key we cannot generate the recovery link.
    // Log loudly and still return 202 so we don't leak config issues.
    logError("auth:forgot", new Error("SUPABASE_SERVICE_ROLE_KEY not set"));
    return NEUTRAL;
  }

  let redirectTo: string;
  try {
    redirectTo = `${getEmailOrigin(req)}/auth/reset`;
  } catch (err) {
    // In production with no APP_URL we refuse to build a recovery link
    // from request headers. Log and return the standard neutral 202 so
    // we never leak this misconfiguration to clients.
    if (err instanceof EmailOriginError) {
      logError("auth:forgot:origin", err);
      return NEUTRAL;
    }
    throw err;
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      // Likely "User not found" — treat as success per the neutral-response
      // contract above. Log so an on-call can spot real provider outages.
      logError("auth:forgot:link", error ?? new Error("no action_link"), { email });
      return NEUTRAL;
    }
    const rendered = passwordResetEmail({
      resetUrl: data.properties.action_link,
      recipientEmail: email,
    });
    // Fire-and-await but never throw. sendEmail already swallows + logs.
    await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      scope: "auth:forgot",
    });
  } catch (err) {
    logError("auth:forgot", err, { email });
  }
  return NEUTRAL;
}
