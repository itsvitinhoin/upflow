import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const isAdmin = auth.prismaUser.role === "admin";

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      avatar_url: true,
      ...(isAdmin && {
        role: true,
        created_at: true,
        _count: { select: { tasks: true, projects: true } },
      }),
    },
  });

  return NextResponse.json(users);
}
