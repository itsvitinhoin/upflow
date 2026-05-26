import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { UserProvider } from "@/components/user-provider";
import type { AppUser } from "@/lib/types";
import { getAuthResult, isSuperAdmin } from "@/lib/auth-helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authResult = await getAuthResult();
  if (authResult.kind === "anonymous") {
    redirect("/login");
  }
  if (authResult.kind === "error") {
    throw authResult.error;
  }

  const auth = authResult.user;
  const prismaUser = auth.prismaUser;

  const user: AppUser = {
    id: prismaUser.id,
    name: prismaUser.name,
    email: prismaUser.email,
    image: prismaUser.avatar_url,
    role: prismaUser.role,
    currentWorkspaceId: auth.currentWorkspaceId,
    currentRole: auth.currentRole,
    isSuperAdmin: isSuperAdmin(auth),
  };

  const workspaces = auth.memberships.map((membership) => ({
    id: membership.workspace.id,
    name: membership.workspace.name,
    slug: membership.workspace.slug,
    role: membership.role,
  }));

  return (
    <UserProvider user={user}>
      <div className="relative flex h-dvh min-h-dvh overflow-hidden overflow-x-hidden bg-background">
        <div className="relative z-10 flex h-full w-full min-w-0">
          <Sidebar user={user} workspaces={workspaces} />
          <main className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="relative z-10 min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
