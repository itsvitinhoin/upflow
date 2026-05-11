import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json() as { email?: string; password?: string; name?: string };
  const { email, password, name } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ id: existing.id, email: existing.email, name: existing.name, role: existing.role });
  }

  if (email && password) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email.split("@")[0] },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
