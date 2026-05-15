import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

export interface AuthUser {
  supabaseId: string;
  prismaUser: User;
}

function adminAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  // No fallback in production: an unset ADMIN_EMAILS means "no auto-admins"
  // and existing admin users keep their role. In dev, seed a default to keep
  // local workflows smooth.
  if (process.env.NODE_ENV === "production") return [];
  return ["admin@upflow.io"];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminAllowlist().includes(email.toLowerCase());
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return null;

    const wantsAdmin = isAdminEmail(user.email);

    const prismaUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name:
          (user.user_metadata?.name as string | undefined) ||
          (user.user_metadata?.full_name as string | undefined) ||
          user.email.split("@")[0],
        // Only auto-promote on creation if the email is allowlisted. Otherwise
        // default to member — admins must be granted explicitly via ADMIN_EMAILS
        // or a future admin-management UI.
        role: wantsAdmin ? "admin" : "member",
      },
    });

    if (wantsAdmin && prismaUser.role !== "admin") {
      await prisma.user.update({
        where: { id: prismaUser.id },
        data: { role: "admin" },
      });
      prismaUser.role = "admin";
    }

    return { supabaseId: user.id, prismaUser };
  } catch {
    return null;
  }
}
