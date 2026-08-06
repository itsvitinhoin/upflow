import { after, NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import {
  completeGoogleCalendarConnect,
  getGoogleCalendarConfig,
  getGoogleCalendarLoginRecoveryUrl,
  getGoogleCalendarResultUrl,
  syncGoogleCalendarAgenda,
} from "@/lib/google-calendar";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function oauthRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  // OAuth callbacks can contain one-time state and authorization-code values.
  // The recovery URL deliberately omits them, and the response must not be
  // cached or forwarded in a later Referer header.
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

async function GET_handler(req: NextRequest) {
  const config = getGoogleCalendarConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured" },
      { status: 503 },
    );
  }

  const result = await requireAuth();
  if (!result.ok) {
    // OAuth state alone is not a replacement for the member's authenticated
    // UpFlow session. Recover through canonical sign-in instead of returning
    // a raw 401 after a valid Google approval on another hostname.
    logError(
      "api:integrations/google-calendar:callback:session-required",
      new Error("Google Calendar callback completed without an authenticated UpFlow session"),
    );
    return oauthRedirect(getGoogleCalendarLoginRecoveryUrl(config, "session_required"));
  }

  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state") || "";
  const code = searchParams.get("code") || "";
  if (searchParams.has("error") || !state || !code) {
    return oauthRedirect(getGoogleCalendarResultUrl(config, "error"));
  }

  const completion = await completeGoogleCalendarConnect({
    state,
    code,
    userId: result.auth.prismaUser.id,
  });
  if (completion.ok) {
    // Start the shared-agenda cache immediately after a successful OAuth
    // connection. The normal daily maintenance pass keeps it fresh after this.
    after(() =>
      syncGoogleCalendarAgenda({
        workspaceId: completion.workspaceId,
        userId: result.auth.prismaUser.id,
      }).catch((error) =>
        logError("api:integrations/google-calendar:callback:agenda-sync", error),
      ),
    );
  }
  if (!completion.ok) {
    logError(
      "api:integrations/google-calendar:callback:authorization-failed",
      new Error("Google Calendar authorization could not be completed"),
    );
  }
  return oauthRedirect(
    getGoogleCalendarResultUrl(config, completion.ok ? "connected" : "error"),
  );
}

export const GET = withErrorReporting(
  "api:integrations/google-calendar/callback:GET",
  GET_handler,
);
