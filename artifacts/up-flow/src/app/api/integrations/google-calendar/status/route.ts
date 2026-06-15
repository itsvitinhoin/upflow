import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { requireCurrentWorkspace } from "@/lib/api/scope";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const clientIdConfigured = Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID);
  const clientSecretConfigured = Boolean(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
  const redirectUriConfigured = Boolean(process.env.GOOGLE_CALENDAR_REDIRECT_URI);
  const ready = clientIdConfigured && clientSecretConfigured && redirectUriConfigured;

  return NextResponse.json({
    provider: "google_calendar",
    workspace_id: scope.workspaceId,
    connected: false,
    ready,
    checks: {
      google_calendar_client_id_configured: clientIdConfigured,
      google_calendar_client_secret_configured: clientSecretConfigured,
      google_calendar_redirect_uri_configured: redirectUriConfigured,
    },
    next_step: ready
      ? "OAuth configuration is present. Add a connect flow and token storage before enabling sync."
      : "Configure GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI.",
  });
}

export const GET = withErrorReporting(
  "api:integrations/google-calendar/status:GET",
  GET_handler,
);
