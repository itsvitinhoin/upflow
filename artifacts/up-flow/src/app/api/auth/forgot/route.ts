import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { getEmailOrigin, EmailOriginError } from "@/lib/email/origin";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";

/**
 * Kick off a password reset.
 *
 * We always respond 202 to avoid leaking which addresses have accounts.
 * Custom Resend email is used when fully configured. If that send path is
 * unavailable, we fall back to Supabase Auth's native recovery email so the
 * request does not silently succeed without sending anything.
 */
async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, { windowMs: 60_000, max: 5, key: "forgot" });
  if (!rl.ok) return rateLimitResponse(rl);

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  const NEUTRAL = NextResponse.json({ status: "accepted" }, { status: 202 });

  if (!email) return NEUTRAL;
  // Cheap shape check; full validation happens at Supabase.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NEUTRAL;

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

  const sentCustomEmail = await sendCustomResetEmail(email, redirectTo);
  if (!sentCustomEmail) {
    await sendSupabaseRecoveryEmail(email, redirectTo);
  }

  return NEUTRAL;
}

async function sendCustomResetEmail(email: string, redirectTo: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    logError(
      "auth:forgot:custom-email",
      new Error("SUPABASE_SERVICE_ROLE_KEY not set; using Supabase recovery email fallback"),
    );
    return false;
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error || !data?.properties?.action_link) {
      // Likely "User not found" - treat as success per the neutral-response
      // contract above. Log so an on-call can spot real provider outages.
      logError("auth:forgot:link", error ?? new Error("no action_link"), { email });
      return true;
    }

    const rendered = passwordResetEmail({
      resetUrl: data.properties.action_link,
      recipientEmail: email,
    });
    const result = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      scope: "auth:forgot",
    });

    if (!result.ok) {
      logError("auth:forgot:custom-email", new Error(result.error ?? "email send failed"), {
        email,
      });
      return false;
    }

    return true;
  } catch (err) {
    logError("auth:forgot:custom-email", err, { email });
    return false;
  }
}

async function sendSupabaseRecoveryEmail(email: string, redirectTo: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    logError("auth:forgot:supabase-recovery", new Error("Supabase public auth env is not set"));
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      logError("auth:forgot:supabase-recovery", error, { email });
      return false;
    }
    return true;
  } catch (err) {
    logError("auth:forgot:supabase-recovery", err, { email });
    return false;
  }
}

export const POST = withErrorReporting("api:auth/forgot:POST", POST_handler);
