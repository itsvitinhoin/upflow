import type { AppUser } from "@/lib/types";

type WorkspaceAccessUser = Pick<AppUser, "currentRole" | "isSuperAdmin"> | null | undefined;

/**
 * Mirrors the client-visible portion of the workspace-admin rule. This only
 * controls which actions the UI offers; API routes remain the source of truth
 * for authorization.
 */
export function hasWorkspaceAdminAccess(user: WorkspaceAccessUser): boolean {
  return Boolean(
    user?.isSuperAdmin || user?.currentRole === "owner" || user?.currentRole === "admin",
  );
}
