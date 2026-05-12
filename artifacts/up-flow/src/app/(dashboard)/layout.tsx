import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/sidebar";
import { UserProvider } from "@/components/user-provider";
import type { AppUser } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser?.email) {
    redirect("/login");
  }

  // Upsert: auto-create Prisma row on first login so any Supabase user can access the app
  const prismaUser = await prisma.user.upsert({
    where: { email: supabaseUser.email },
    update: {},
    create: {
      email: supabaseUser.email,
      name:
        (supabaseUser.user_metadata?.name as string | undefined) ||
        (supabaseUser.user_metadata?.full_name as string | undefined) ||
        supabaseUser.email.split("@")[0],
      role: "member",
    },
    select: { id: true, name: true, email: true, role: true, avatar_url: true },
  });

  const user: AppUser = {
    id: prismaUser.id,
    name: prismaUser.name,
    email: prismaUser.email,
    image: prismaUser.avatar_url,
    role: prismaUser.role,
  };

  return (
    <UserProvider user={user}>
      <div className="relative flex h-screen overflow-hidden bg-background">
        <div className="relative z-10 flex w-full h-full">
          <Sidebar user={user} />
          <main className="relative flex-1 overflow-y-auto">
            {/* Orbs are confined to the main content area so they do not
                bleed under the sidebar. */}
            <div className="bg-orbs" aria-hidden><span /></div>
            <div className="relative z-10">{children}</div>
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
