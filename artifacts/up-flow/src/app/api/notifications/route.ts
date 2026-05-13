import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const notifications = await prisma.notification.findMany({
    where: { user_id: auth.prismaUser.id },
    orderBy: { created_at: "desc" },
    take: 50,
    include: {
      task: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(notifications);
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const onlyRead = searchParams.get("read") === "true";

  const where = onlyRead
    ? { user_id: auth.prismaUser.id, read: true }
    : { user_id: auth.prismaUser.id };

  const result = await prisma.notification.deleteMany({ where });
  return NextResponse.json({ deleted: result.count });
}
