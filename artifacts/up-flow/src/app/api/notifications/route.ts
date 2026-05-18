import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const { limit, cursor } = parsePagination(req, { defaultLimit: 50, maxLimit: 200 });

  const rows = await prisma.notification.findMany({
    where: { user_id: auth.prismaUser.id },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
    include: {
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true } },
        },
      },
      workspace: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return NextResponse.json(buildPage(rows, limit));
}

async function DELETE_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const { searchParams } = new URL(req.url);
  const onlyRead = searchParams.get("read") === "true";

  const where = onlyRead
    ? { user_id: auth.prismaUser.id, read: true }
    : { user_id: auth.prismaUser.id };

  const result = await prisma.notification.deleteMany({ where });
  return NextResponse.json({ deleted: result.count });
}
export const GET = withErrorReporting("api:notifications:GET", GET_handler);
export const DELETE = withErrorReporting("api:notifications:DELETE", DELETE_handler);
