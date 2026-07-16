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
  const lifecycle = searchParams.get("lifecycle");
  const q = searchParams.get("q")?.trim() || "";

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: [] });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }
  const project = projectId
    ? await prisma.project.findFirst({
        where: { id: projectId, workspace_id: auth.currentWorkspaceId },
        select: { company_id: true },
      })
    : null;
  const projectCompanyId = project?.company_id ?? null;
  const scopedLookup = Boolean(companyId || projectId);
  const lifecycleScope =
    lifecycle === "completed"
      ? { status: "onboarding_complete" as const }
      : lifecycle === "active"
        ? { status: { not: "onboarding_complete" as const } }
        : null;
  const scope = scopedLookup
    ? {
        OR: [
          ...(companyId ? [{ company_id: companyId }] : []),
          ...(projectId ? [{ project_id: projectId }] : []),
          ...(projectCompanyId && projectCompanyId !== companyId ? [{ company_id: projectCompanyId }] : []),
        ],
      }
    : lifecycleScope ?? { status: { not: "onboarding_complete" as const } };
  const searchScope = q
    ? {
        OR: [
          { company: { is: { name: { contains: q, mode: "insensitive" as const } } } },
          { salesperson: { is: { name: { contains: q, mode: "insensitive" as const } } } },
          {
            checklist_items: {
              some: {
                OR: [
                  { department: { contains: q, mode: "insensitive" as const } },
                  { title: { contains: q, mode: "insensitive" as const } },
                  { owner: { is: { name: { contains: q, mode: "insensitive" as const } } } },
                ],
              },
            },
          },
          {
            service_assignments: {
              some: {
                OR: [
                  { service: { contains: q, mode: "insensitive" as const } },
                  { department_name: { contains: q, mode: "insensitive" as const } },
                  { leader: { is: { name: { contains: q, mode: "insensitive" as const } } } },
                ],
              },
            },
          },
        ],
      }
    : {};

  const rows = await prisma.clientOnboarding.findMany({
    where: {
      workspace_id: auth.currentWorkspaceId,
      AND: [scope, searchScope],
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
