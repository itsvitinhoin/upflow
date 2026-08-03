import { NextResponse } from "next/server";
import { requireCurrentWorkspace } from "@/lib/api/scope";
import { requireAuth } from "@/lib/auth-response";
import { getGoogleCalendarConfig, listGoogleCalendars } from "@/lib/google-calendar";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function GET_handler() {
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

  try {
    const items = await listGoogleCalendars({
      workspaceId: scope.workspaceId,
      userId: result.auth.prismaUser.id,
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: "Google Calendars could not be loaded. Reconnect Google Calendar and try again." },
      { status: 502 },
    );
  }
}

export const GET = withErrorReporting(
  "api:integrations/google-calendar/calendars:GET",
  GET_handler,
);
