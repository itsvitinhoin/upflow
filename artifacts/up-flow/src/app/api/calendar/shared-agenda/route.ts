import { NextRequest, NextResponse } from "next/server";
import { requireCurrentWorkspace } from "@/lib/api/scope";
import { requireAuth } from "@/lib/auth-response";
import { prisma } from "@/lib/prisma";
import { parseDateParam } from "@/lib/time-range";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_LOOKAHEAD_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_SHARED_AGENDA_ITEMS = 5_000;

async function GET_handler(req: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.ok) return authResult.response;
  const scope = await requireCurrentWorkspace(authResult.auth);
  if (!scope.ok) return scope.response;

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const from = parseDateParam(searchParams.get("from")) ?? new Date(now.getTime() - DEFAULT_LOOKBACK_MS);
  const to = parseDateParam(searchParams.get("to")) ?? new Date(now.getTime() + DEFAULT_LOOKAHEAD_MS);
  if (from.getTime() >= to.getTime()) {
    return NextResponse.json({ error: "Invalid shared agenda range" }, { status: 400 });
  }

  const items = await prisma.googleCalendarAgendaEntry.findMany({
    where: {
      workspace_id: scope.workspaceId,
      starts_at: { lt: to },
      ends_at: { gt: from },
      connection: {
        share_agenda: true,
        disconnected_at: null,
      },
      user: {
        memberships: {
          some: {
            workspace_id: scope.workspaceId,
            status: "active",
          },
        },
      },
    },
    orderBy: [{ starts_at: "asc" }, { id: "asc" }],
    take: MAX_SHARED_AGENDA_ITEMS,
    select: {
      id: true,
      title: true,
      starts_at: true,
      ends_at: true,
      all_day: true,
      is_private: true,
      user: {
        select: { id: true, name: true, email: true, avatar_url: true },
      },
    },
  });

  return NextResponse.json({ items, nextCursor: null });
}

export const GET = withErrorReporting("api:calendar/shared-agenda:GET", GET_handler);
