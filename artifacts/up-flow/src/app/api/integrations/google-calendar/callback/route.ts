import { after, NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import {
  completeGoogleCalendarConnect,
  getGoogleCalendarConfig,
  getGoogleCalendarResultUrl,
  syncGoogleCalendarAgenda,
} from "@/lib/google-calendar";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function GET_handler(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.response;

  const config = getGoogleCalendarConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state") || "";
  const code = searchParams.get("code") || "";
  if (searchParams.has("error") || !state || !code) {
    return NextResponse.redirect(getGoogleCalendarResultUrl(config, "error"));
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
  return NextResponse.redirect(
    getGoogleCalendarResultUrl(config, completion.ok ? "connected" : "error"),
  );
}

export const GET = withErrorReporting(
  "api:integrations/google-calendar/callback:GET",
  GET_handler,
);
