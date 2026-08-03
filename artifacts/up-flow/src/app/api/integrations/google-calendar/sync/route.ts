import { NextRequest, NextResponse } from "next/server";
import { requireCurrentWorkspace } from "@/lib/api/scope";
import { requireAuth } from "@/lib/auth-response";
import { getGoogleCalendarConfig, syncUpcomingGoogleCalendarEvents } from "@/lib/google-calendar";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function POST_handler(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.response;
  const scope = await requireCurrentWorkspace(result.auth);
  if (!scope.ok) return scope.response;
  if (!getGoogleCalendarConfig()) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured" },
      { status: 503 },
    );
  }

  const limit = await checkRateLimit(req, {
    windowMs: 60_000,
    max: 5,
    key: "google-calendar-sync",
    requireSharedStore: true,
  });
  if (!limit.ok) return rateLimitResponse(limit);

  const counts = await syncUpcomingGoogleCalendarEvents({
    workspaceId: scope.workspaceId,
    userId: result.auth.prismaUser.id,
  });
  return NextResponse.json(counts);
}

export const POST = withErrorReporting(
  "api:integrations/google-calendar/sync:POST",
  POST_handler,
);
