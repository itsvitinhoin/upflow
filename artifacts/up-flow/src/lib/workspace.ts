import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { WorkspaceRole } from "@prisma/client";
import { logError } from "@/lib/log-error";

export const WORKSPACE_COOKIE = "upflow_ws";

export interface MembershipLite {
  workspace_id: string;
  role: WorkspaceRole;
  workspace: { id: string; name: string; slug: string };
}

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let suffix = 0;
  // Attempt up to 20 random suffixes; collisions extremely rare.
  while (await prisma.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1;
    slug = `${slugify(base)}-${Math.random().toString(36).slice(2, 6)}`;
    if (suffix > 20) {
      slug = `${slugify(base)}-${Date.now().toString(36)}`;
      break;
    }
  }
  return slug;
}

/**
 * Ensure the user owns a personal workspace. This is used by invite
 * acceptance so new users can try UP Flow without being dropped into the
 * inviter's Admin workspace.
 */
export async function ensureOwnedWorkspace(userId: string, displayName: string) {
  const existingOwned = await prisma.workspaceMember.findFirst({
    where: { user_id: userId, role: "owner", status: "active" },
    select: {
      workspace: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { created_at: "asc" },
  });
  if (existingOwned?.workspace) return existingOwned.workspace;

  const safeName = displayName?.trim() || "My";
  const name = `${safeName}'s Workspace`;
  const slug = await uniqueSlug(safeName);
  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      members: { create: { user_id: userId, role: "owner" } },
    },
    select: { id: true, name: true, slug: true },
  });
  return workspace;
}

/**
 * Make sure a freshly-logged-in user always lands in a workspace.
 *
 * First-login users get a personal workspace where they are owner. We do not
 * auto-join a seeded/shared workspace, because invited users should not receive
 * access to the Admin workspace unless explicitly added later.
 */
export async function ensureDefaultWorkspace(userId: string, displayName: string) {
  try {
    const existing = await prisma.workspaceMember.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });
    if (existing) return;

    await ensureOwnedWorkspace(userId, displayName);
  } catch (err) {
    // The only expected failure mode is a unique-constraint race when two
    // concurrent first-logins try to provision at the same time. Anything
    // else is genuinely unexpected, so log it instead of swallowing.
    const code = (err as { code?: string }).code;
    if (code !== "P2002") {
      logError("workspace:ensureDefault", err, { userId });
    }
  }
}

// Backwards-compat alias for callers expecting the original name.
export const ensurePersonalWorkspace = ensureDefaultWorkspace;

export async function loadMemberships(userId: string): Promise<MembershipLite[]> {
  const rows = await prisma.workspaceMember.findMany({
    where: { user_id: userId, status: "active" },
    select: {
      workspace_id: true,
      role: true,
      workspace: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { created_at: "asc" },
  });
  return rows;
}

export function resolveCurrentWorkspaceId(
  memberships: MembershipLite[],
  cookieValue: string | undefined,
): string {
  if (cookieValue && memberships.some((m) => m.workspace_id === cookieValue)) {
    return cookieValue;
  }
  return memberships[0]?.workspace_id ?? "";
}

export async function readWorkspaceCookie(): Promise<string | undefined> {
  try {
    return (await cookies()).get(WORKSPACE_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

export function isAdminRole(role: WorkspaceRole | undefined | null): boolean {
  return role === "owner" || role === "admin";
}
