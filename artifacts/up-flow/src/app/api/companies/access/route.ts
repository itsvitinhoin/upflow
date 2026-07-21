import { NextResponse } from "next/server";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { resolveCompanyCreationAccess } from "@/lib/company-creation-access";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const workspaceId = auth.currentWorkspaceId;

  if (!workspaceId) {
    return NextResponse.json(
      { can_create_standalone: false, can_start_onboarding: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const currentMembership = auth.memberships.find(
    (membership) => membership.workspace_id === workspaceId,
  );
  const access = resolveCompanyCreationAccess({
    isWorkspaceAdmin: isWorkspaceAdminFor(auth, workspaceId),
    membership: currentMembership
      ? {
          role: currentMembership.role,
          // Auth memberships include active rows only.
          status: "active",
          departmentName: currentMembership.department?.name,
        }
      : null,
  });

  return NextResponse.json(
    {
      can_create_standalone: access.canCreateStandalone,
      can_start_onboarding: access.canStartOnboarding,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export const GET = withErrorReporting("api:companies:access:GET", GET_handler);
