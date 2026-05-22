import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;

  const unread = await prisma.notification.count({
    where: { user_id: _r.auth.prismaUser.id, read: false },
  });

  return NextResponse.json({ unread });
}

export const GET = withErrorReporting(
  "api:notifications/unread-count:GET",
  GET_handler,
);
