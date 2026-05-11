import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json() as { email?: string; password?: string; name?: string };
  const { email, name } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ id: existing.id, email: existing.email, name: existing.name, role: existing.role });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || email.split("@")[0],
      role: "member",
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
