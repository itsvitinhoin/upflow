import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { createClientOnboardingFromWizard } from "@/lib/onboarding";
import { withErrorReporting } from "@/lib/with-error-reporting";

const WizardSchema = z.object({
  company_id: z.string().trim().nullable().optional(),
  name: z.string().trim().min(1),
  website: z.string().trim().url().nullable().optional(),
  industry: z.string().trim().nullable().optional(),
  service_type: z.string().trim().nullable().optional(),
  plan_name: z.string().trim().nullable().optional(),
  billing_cycle: z.string().trim().nullable().optional(),
  included_services: z.array(z.string().trim().min(1)).min(1).max(50),
  notes: z.string().trim().nullable().optional(),
  contact_name: z.string().trim().nullable().optional(),
  contact_email: z.string().trim().email().nullable().optional(),
  contact_phone: z.string().trim().nullable().optional(),
  contact_role: z.string().trim().nullable().optional(),
  owner_id: z.string().trim().nullable().optional(),
  expected_start_date: z.string().trim().min(1),
  closing_date: z.string().trim().nullable().optional(),
  initial_notes: z.string().trim().nullable().optional(),
  responsible_salesperson_id: z.string().trim().nullable().optional(),
  responsible_department_id: z.string().trim().nullable().optional(),
  responsible_department_name: z.string().trim().nullable().optional(),
  contract_value: z.number().nullable().optional(),
});

function parseDate(value: string | null | undefined, label: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}`);
  }
  return date;
}

async function canStartClientOnboarding(userId: string, workspaceId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspace_id_user_id: {
        workspace_id: workspaceId,
        user_id: userId,
      },
    },
    include: { department: { select: { name: true } } },
  });
  if (!member || member.status !== "active" || member.role === "guest") return false;
  const department = member.department?.name?.toLowerCase() ?? "";
  return department.includes("commercial") || department.includes("sales");
}

async function ensureWorkspaceUser(userId: string | null | undefined, workspaceId: string, label: string) {
  if (!userId) return null;
  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspace_id: workspaceId,
      user_id: userId,
      status: "active",
      role: { not: "guest" },
    },
    select: { user_id: true },
  });
  if (!member) {
    throw new Error(`${label} is not an active workspace member.`);
  }
  return member.user_id;
}

async function ensureWorkspaceDepartment(departmentId: string | null | undefined, workspaceId: string) {
  if (!departmentId) return null;
  const department = await prisma.department.findFirst({
    where: { id: departmentId, workspace_id: workspaceId },
    select: { id: true, name: true },
  });
  if (!department) {
    throw new Error("Selected responsible department is not available in this workspace.");
  }
  return department;
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const workspaceId = auth.currentWorkspaceId;
  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  const isAdmin = isWorkspaceAdminFor(auth, workspaceId);
  const allowed = await canStartClientOnboarding(auth.prismaUser.id, workspaceId, isAdmin);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = WizardSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client onboarding wizard", issues: parsed.error.flatten() }, { status: 400 });
  }

  const companyId = parsed.data.company_id || null;
  if (companyId) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!company) return NextResponse.json({ error: "Client not found in this workspace" }, { status: 404 });
  }

  try {
    const ownerId = await ensureWorkspaceUser(parsed.data.owner_id || null, workspaceId, "Selected owner");
    const salespersonId = await ensureWorkspaceUser(
      parsed.data.responsible_salesperson_id || ownerId,
      workspaceId,
      "Selected salesperson",
    );
    const responsibleDepartment = await ensureWorkspaceDepartment(
      parsed.data.responsible_department_id || null,
      workspaceId,
    );
    const result = await createClientOnboardingFromWizard({
      workspaceId,
      actorId: auth.prismaUser.id,
      companyId,
      name: parsed.data.name,
      website: parsed.data.website ?? null,
      industry: parsed.data.industry ?? null,
      serviceType: parsed.data.service_type ?? null,
      planName: parsed.data.plan_name ?? null,
      billingCycle: parsed.data.billing_cycle ?? null,
      includedServices: parsed.data.included_services,
      notes: parsed.data.notes ?? null,
      contactName: parsed.data.contact_name ?? null,
      contactEmail: parsed.data.contact_email ?? null,
      contactPhone: parsed.data.contact_phone ?? null,
      contactRole: parsed.data.contact_role ?? null,
      ownerId: ownerId ?? auth.prismaUser.id,
      expectedStartDate: parseDate(parsed.data.expected_start_date, "expected start date"),
      closingDate: parseDate(parsed.data.closing_date ?? null, "closing date"),
      initialNotes: parsed.data.initial_notes ?? parsed.data.notes ?? null,
      responsibleSalespersonId: salespersonId ?? ownerId ?? auth.prismaUser.id,
      responsibleDepartmentId: responsibleDepartment?.id ?? null,
      responsibleDepartmentName:
        responsibleDepartment?.name ?? parsed.data.responsible_department_name ?? null,
      contractValue: parsed.data.contract_value ?? null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to start onboarding" },
      { status: 400 },
    );
  }
}

export const POST = withErrorReporting("api:onboarding/client-wizard:POST", POST_handler);
