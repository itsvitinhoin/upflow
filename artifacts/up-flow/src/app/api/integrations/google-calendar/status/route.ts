import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { requireCurrentWorkspace } from "@/lib/api/scope";
import { getGoogleCalendarConnectionStatus } from "@/lib/google-calendar";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  return NextResponse.json(
    await getGoogleCalendarConnectionStatus({
      workspaceId: scope.workspaceId,
      userId: auth.prismaUser.id,
    }),
  );
}

export const GET = withErrorReporting(
  "api:integrations/google-calendar/status:GET",
  GET_handler,
);
