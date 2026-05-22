import { NextResponse } from "next/server";
import { isWorkspaceAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

const DEVELOPMENT_FROM = "Up Flow <onboarding@resend.dev>";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const appUrlConfigured = Boolean(process.env.APP_URL?.trim());
  const resendApiKeyConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const emailFrom = process.env.EMAIL_FROM?.trim();
  const emailFromConfigured = Boolean(emailFrom);
  const usingDevelopmentSender = !emailFrom || emailFrom === DEVELOPMENT_FROM;

  return NextResponse.json({
    app_url_configured: appUrlConfigured,
    resend_api_key_configured: resendApiKeyConfigured,
    email_from_configured: emailFromConfigured,
    using_development_sender: usingDevelopmentSender,
    ready:
      appUrlConfigured &&
      resendApiKeyConfigured &&
      emailFromConfigured &&
      !usingDevelopmentSender,
  });
}

export const GET = withErrorReporting("api:email/status:GET", GET_handler);
