import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspace } from "@/lib/api/scope";
import { requireAuth } from "@/lib/auth-response";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarConfig,
  updateGoogleCalendarConnection,
} from "@/lib/google-calendar";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ConnectionSchema = z
  .object({
    calendar_id: z.string().trim().min(1).max(1024).optional(),
    // The client may send this for optimistic display, but the server always
    // obtains the trusted calendar name from Google before persisting it.
    calendar_name: z.string().trim().max(1024).optional(),
    sync_enabled: z.boolean().optional(),
  })
  .refine((value) => value.calendar_id !== undefined || value.sync_enabled !== undefined, {
    message: "At least one connection setting is required",
  });

async function PATCH_handler(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.response;
  const scope = await requireCurrentWorkspace(result.auth);
  if (!scope.ok) return scope.response;

  const parsed = ConnectionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Google Calendar settings" }, { status: 400 });
  }
  if (parsed.data.calendar_id && !getGoogleCalendarConfig()) {
    return NextResponse.json(
      { error: "Google Calendar integration is not configured" },
      { status: 503 },
    );
  }

  try {
    const connection = await updateGoogleCalendarConnection({
      workspaceId: scope.workspaceId,
      userId: result.auth.prismaUser.id,
      calendarId: parsed.data.calendar_id,
      syncEnabled: parsed.data.sync_enabled,
    });
    if (!connection) {
      return NextResponse.json({ error: "Google Calendar is not connected" }, { status: 404 });
    }
    return NextResponse.json({ connected: true, connection });
  } catch {
    return NextResponse.json(
      { error: "Google Calendar settings could not be updated. Reconnect Google Calendar and try again." },
      { status: 502 },
    );
  }
}

async function DELETE_handler() {
  const result = await requireAuth();
  if (!result.ok) return result.response;
  const scope = await requireCurrentWorkspace(result.auth);
  if (!scope.ok) return scope.response;

  await disconnectGoogleCalendar({
    workspaceId: scope.workspaceId,
    userId: result.auth.prismaUser.id,
  });
  return NextResponse.json({ connected: false });
}

export const PATCH = withErrorReporting(
  "api:integrations/google-calendar/connection:PATCH",
  PATCH_handler,
);
export const DELETE = withErrorReporting(
  "api:integrations/google-calendar/connection:DELETE",
  DELETE_handler,
);
