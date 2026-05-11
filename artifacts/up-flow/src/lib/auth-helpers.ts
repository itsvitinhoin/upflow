import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export interface AuthUser {
  supabaseId: string;
  prismaUser: User;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return null;

    // Upsert: create Prisma user on first login if they don't exist yet
    const prismaUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name:
          (user.user_metadata?.name as string | undefined) ||
          (user.user_metadata?.full_name as string | undefined) ||
          user.email.split("@")[0],
        role: "member",
      },
    });

    return { supabaseId: user.id, prismaUser };
  } catch {
    return null;
  }
}
