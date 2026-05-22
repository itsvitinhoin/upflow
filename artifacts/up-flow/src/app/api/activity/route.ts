import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));

  const items = await prisma.activityEvent.findMany({
    where: { workspace_id: auth.currentWorkspaceId },
    take: limit,
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
    include: {
      actor: { select: { id: true, name: true, email: true, avatar_url: true } },
    },
  });

  return NextResponse.json({ items, nextCursor: null });
}

export const GET = withErrorReporting("api:activity:GET", GET_handler);
