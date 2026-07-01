import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { onboardingSelect, redactOnboardingContracts, loadOnboardingAccess } from "@/lib/onboarding";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("company_id");
  const projectId = searchParams.get("project_id");

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: [] });
  }
  const rows = await prisma.clientOnboarding.findMany({
    where: {
      workspace_id: auth.currentWorkspaceId,
      ...(companyId ? { company_id: companyId } : {}),
      ...(projectId ? { project_id: projectId } : {}),
      ...(!companyId && !projectId ? { status: { not: "onboarding_complete" } } : {}),
    },
    orderBy: [
      { status: "asc" },
      { expected_start_date: "asc" },
      { created_at: "desc" },
      { id: "asc" },
    ],
    select: onboardingSelect(),
  });

  const items = [];
  for (const row of rows) {
    if (!canAccessWorkspace(auth, row.workspace_id)) continue;
    const access = await loadOnboardingAccess(auth, row.id);
    items.push(redactOnboardingContracts(row, Boolean(access?.canViewPrivateContract)));
  }

  return NextResponse.json({ items });
}

export const GET = withErrorReporting("api:onboarding:GET", GET_handler);
