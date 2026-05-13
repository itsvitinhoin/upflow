import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
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

  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (notification.user_id !== auth.prismaUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(notification);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notification = await prisma.notification.findUnique({ where: { id: params.id } });
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (notification.user_id !== auth.prismaUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { read?: boolean };
  const updated = await prisma.notification.update({
    where: { id: params.id },
    data: { read: body.read ?? true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const notification = await prisma.notification.findUnique({ where: { id: params.id } });
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (notification.user_id !== auth.prismaUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.notification.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
