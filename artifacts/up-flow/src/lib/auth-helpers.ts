import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User, WorkspaceRole } from "@prisma/client";
import {
  ensurePersonalWorkspace,
  loadMemberships,
  readWorkspaceCookie,
  resolveCurrentWorkspaceId,
  isAdminRole,
  type MembershipLite,
} from "@/lib/workspace";

export interface AuthUser {
  supabaseId: string;
  prismaUser: User;
  memberships: MembershipLite[];
  currentWorkspaceId: string;
  currentRole: WorkspaceRole | null;
}

function adminAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
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
    const displayName =
      (user.user_metadata?.name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email.split("@")[0];

    const prismaUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: displayName,
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

    // First login: give the user a personal workspace so they always have a
    // home before accepting any invites.
    await ensurePersonalWorkspace(prismaUser.id, prismaUser.name);

    const memberships = await loadMemberships(prismaUser.id);
    const currentWorkspaceId = resolveCurrentWorkspaceId(
      memberships,
      readWorkspaceCookie(),
    );
    const currentRole =
      memberships.find((m) => m.workspace_id === currentWorkspaceId)?.role ?? null;

    return {
      supabaseId: user.id,
      prismaUser,
      memberships,
      currentWorkspaceId,
      currentRole,
    };
  } catch {
    return null;
  }
}

/** Cross-workspace super-admin (provisioned via ADMIN_EMAILS). */
export function isSuperAdmin(auth: AuthUser): boolean {
  return auth.prismaUser.role === "admin";
}

/** Owner or admin in the currently-active workspace, OR super-admin. */
export function isWorkspaceAdmin(auth: AuthUser): boolean {
  return isSuperAdmin(auth) || isAdminRole(auth.currentRole);
}

/** True if the user is a member of (or super-admin over) the workspace. */
export function canAccessWorkspace(auth: AuthUser, workspaceId: string): boolean {
  if (isSuperAdmin(auth)) return true;
  return auth.memberships.some((m) => m.workspace_id === workspaceId);
}

/**
 * For list endpoints — returns a Prisma `where` fragment matching all
 * workspaces the user can read from. Super-admin returns `{}` (no filter).
 */
export function workspaceListFilter(auth: AuthUser): { workspace_id?: { in: string[] } } {
  if (isSuperAdmin(auth)) return {};
  return { workspace_id: { in: auth.memberships.map((m) => m.workspace_id) } };
}

/**
 * For list endpoints scoped to the active workspace only (default behavior
 * for sidebar/main UI). Super-admin sees only the active workspace too so
 * the UI stays predictable.
 */
export function currentWorkspaceFilter(auth: AuthUser): { workspace_id: string } {
  return { workspace_id: auth.currentWorkspaceId };
}
