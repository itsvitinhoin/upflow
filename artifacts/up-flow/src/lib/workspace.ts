import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { WorkspaceRole } from "@prisma/client";

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
 * Ensure the user has at least one workspace membership. First-login users
 * get a personal workspace where they are the owner.
 */
/**
 * Make sure a freshly-logged-in user always lands in a workspace.
 *
 * Order of preference (first match wins):
 *   1) If the default "acme" workspace exists, auto-join the user as a
 *      `member`. This preserves continuity with the seeded sample data and
 *      gives every new user access to the shared org by default.
 *   2) Otherwise, provision a personal workspace where the user is `owner`.
 *
 * The implementation is idempotent: it returns early if the user already
 * has any membership, and any unique-constraint races are swallowed since
 * losing the race just means another concurrent login already finished
 * provisioning.
 */
export async function ensureDefaultWorkspace(userId: string, displayName: string) {
  try {
    const existing = await prisma.workspaceMember.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });
    if (existing) return;

    const acme = await prisma.workspace.findUnique({
      where: { slug: "acme" },
      select: { id: true },
    });
    if (acme) {
      await prisma.workspaceMember.create({
        data: { workspace_id: acme.id, user_id: userId, role: "member" },
      });
      return;
    }

    const name = `${displayName}'s Workspace`;
    const slug = await uniqueSlug(displayName);
    await prisma.workspace.create({
      data: {
        name,
        slug,
        members: { create: { user_id: userId, role: "owner" } },
      },
    });
  } catch (err) {
    // The only expected failure mode is a unique-constraint race when two
    // concurrent first-logins try to provision at the same time. Anything
    // else is genuinely unexpected, so log it instead of swallowing.
    const code = (err as { code?: string }).code;
    if (code !== "P2002") {
      console.error("ensureDefaultWorkspace failed", err);
    }
  }
}

// Backwards-compat alias for callers expecting the original name.
export const ensurePersonalWorkspace = ensureDefaultWorkspace;

export async function loadMemberships(userId: string): Promise<MembershipLite[]> {
  const rows = await prisma.workspaceMember.findMany({
    where: { user_id: userId },
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

export function readWorkspaceCookie(): string | undefined {
  try {
    return cookies().get(WORKSPACE_COOKIE)?.value;
  } catch {
    return undefined;
  }
}

export function isAdminRole(role: WorkspaceRole | undefined | null): boolean {
  return role === "owner" || role === "admin";
}
