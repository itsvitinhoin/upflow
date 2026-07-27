import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { getEmailOrigin, EmailOriginError } from "@/lib/email/origin";
import { logError } from "@/lib/log-error";
import { createPasswordRecoveryStateConfirmationUrl } from "@/lib/supabase/recovery-state";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const runtime = "nodejs";

/**
 * Kick off a password reset.
 *
 * We respond 202 for accepted reset requests so we never reveal whether an
 * address has an account. Custom Resend email is used when fully configured.
 * If that path cannot deliver a usable link, we fall back to Supabase Auth's
 * native recovery email. Infrastructure failures use a generic 503 instead
 * of pretending that a link was sent.
 */
async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, {
    windowMs: 60_000,
    max: 5,
    key: "forgot",
    requireSharedStore: true,
  });
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
    // In production with no trusted APP_URL we refuse to build a recovery
    // link from request headers. This is a global configuration failure, not
    // an account-specific response, so tell the UI to retry instead of
    // claiming that an email was sent.
    if (err instanceof EmailOriginError) {
      logError("auth:forgot:origin", err);
      return unavailableResponse();
    }
    throw err;
  }

  const sentCustomEmail = await sendCustomResetEmail(email, redirectTo);
  const sentRecoveryEmail =
    sentCustomEmail || (await sendSupabaseRecoveryEmail(email, redirectTo));

  if (!sentRecoveryEmail) return unavailableResponse();

  return NEUTRAL;
}

function unavailableResponse() {
  return NextResponse.json(
    { error: "Password reset is temporarily unavailable. Please try again shortly." },
    { status: 503 },
  );
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
      // This can mean an unknown user, but it can also mean that Supabase
      // rejected `redirectTo` or the service key is invalid. Let the native
      // recovery endpoint make the account-enumeration-safe decision instead
      // of falsely reporting a successful email.
      logError("auth:forgot:link", error ?? new Error("no action_link"), { email });
      return false;
    }

    // Do not put Supabase's one-time action link directly in email. Mail
    // scanners can prefetch and consume it before the recipient clicks. The
    // encrypted state survives email-link tracking without exposing the
    // recovery token and is resolved only after an explicit user action.
    const resetUrl = createPasswordRecoveryStateConfirmationUrl({
      appOrigin: new URL(redirectTo).origin,
      actionLink: data.properties.action_link,
      redirectTo,
      secret: serviceKey,
    });
    const rendered = passwordResetEmail({
      resetUrl,
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
