import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth-helpers";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

export const ONBOARDING_STATUSES = [
  "pending_commercial_setup",
  "pending_finance_registration",
  "pending_contract_upload",
  "pending_internal_assignment",
  "pending_support_group",
  "pending_onboarding_scheduling",
  "onboarding_in_progress",
  "onboarding_complete",
] as const;

export const DEFAULT_ONBOARDING_SERVICES = [
  "Meta Ads",
  "Google Ads",
  "Social Media",
  "Creative",
  "Video",
  "Email Marketing",
  "Website",
  "Tracking/Analytics",
  "SEO",
  "Support",
] as const;

type Tx = Prisma.TransactionClient;
type Db = typeof prisma | Tx;

type OnboardingProject = {
  id: string;
  name: string;
  workspace_id: string;
  company_id: string | null;
  owner_id: string;
  closing_date: Date | null;
  onboarding_start_date: Date | null;
  responsible_salesperson_id: string | null;
  initial_notes: string | null;
};

type UserRef = { id: string; name: string; email: string };

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function parseContractedServices(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((item) => (typeof item === "string" ? item : null)));
  }
  if (typeof value === "string") {
    return uniqueStrings(value.split(/,|\r?\n/));
  }
  return [];
}

function departmentStatus(department: string) {
  const key = department.toLowerCase();
  if (key.includes("commercial")) return "pending_commercial_setup";
  if (key.includes("finance")) return "pending_finance_registration";
  if (key.includes("contract")) return "pending_contract_upload";
  if (key.includes("internal")) return "pending_internal_assignment";
  if (key.includes("support")) return "pending_support_group";
  if (key.includes("service")) return "pending_onboarding_scheduling";
  return "onboarding_in_progress";
}

function serviceKey(service: string) {
  return service.trim().toLowerCase();
}

async function findDepartmentOwner(db: Db, workspaceId: string, matcher: RegExp): Promise<UserRef | null> {
  const member = await db.workspaceMember.findFirst({
    where: {
      workspace_id: workspaceId,
      status: "active",
      role: { not: "guest" },
      department: { name: { contains: matcher.source, mode: "insensitive" } },
    },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  return member?.user ?? null;
}

async function findDepartmentByName(db: Db, workspaceId: string, matcher: RegExp) {
  return db.department.findFirst({
    where: { workspace_id: workspaceId, name: { contains: matcher.source, mode: "insensitive" } },
    select: { id: true, name: true },
  });
}

export async function startClientOnboarding(input: {
  projectId: string;
  actorId: string;
  services?: string[];
  closingDate?: Date | null;
  expectedStartDate?: Date | null;
  initialNotes?: string | null;
  responsibleSalespersonId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        name: true,
        workspace_id: true,
        company_id: true,
        owner_id: true,
        closing_date: true,
        onboarding_start_date: true,
        responsible_salesperson_id: true,
        initial_notes: true,
        company: {
          select: {
            id: true,
            name: true,
            included_services: true,
            service_type: true,
            plan_name: true,
          },
        },
      },
    });
    if (!project?.company_id || !project.company) {
      throw new Error("Onboarding requires a project linked to a client.");
    }

    const existing = await tx.clientOnboarding.findUnique({
      where: { project_id: project.id },
      include: onboardingInclude(),
    });
    if (existing) return existing;

    const services = uniqueStrings([
      ...(input.services ?? []),
      ...parseContractedServices(project.company.included_services),
      project.company.service_type,
    ]);
    const contractedServices = services.length ? services : ["General onboarding"];
    const mappingRows = await tx.serviceLeaderMapping.findMany({
      where: {
        workspace_id: project.workspace_id,
        active: true,
        service: { in: contractedServices },
      },
      include: {
        department: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true } },
      },
    });
    const mappingByService = new Map(mappingRows.map((mapping) => [serviceKey(mapping.service), mapping]));
    const financeOwner = await findDepartmentOwner(tx, project.workspace_id, /finance/i);
    const supportOwner = await findDepartmentOwner(tx, project.workspace_id, /support/i);
    const supportDepartment = await findDepartmentByName(tx, project.workspace_id, /support/i);
    const salespersonId =
      input.responsibleSalespersonId ??
      project.responsible_salesperson_id ??
      project.owner_id;

    const onboarding = await tx.clientOnboarding.create({
      data: {
        workspace_id: project.workspace_id,
        company_id: project.company_id,
        project_id: project.id,
        status: "pending_finance_registration",
        progress: 0,
        closing_date: input.closingDate ?? project.closing_date ?? null,
        expected_start_date: input.expectedStartDate ?? project.onboarding_start_date ?? null,
        responsible_salesperson_id: salespersonId,
        initial_notes: input.initialNotes ?? project.initial_notes ?? null,
        contracted_services: contractedServices,
        created_by: input.actorId,
      },
    });

    await tx.project.update({
      where: { id: project.id },
      data: {
        onboarding_enabled: true,
        responsible_salesperson_id: salespersonId,
        ...(input.closingDate !== undefined && { closing_date: input.closingDate }),
        ...(input.expectedStartDate !== undefined && { onboarding_start_date: input.expectedStartDate }),
        ...(input.initialNotes !== undefined && { initial_notes: input.initialNotes }),
      },
    });

    const commercialTask = await tx.task.create({
      data: {
        project_id: project.id,
        company_id: project.company_id,
        title: "Onboarding: commercial setup confirmed",
        description: "Project created with client, services, salesperson, closing date, and initial notes.",
        status: "done",
        priority: "high",
        assignee_id: salespersonId,
        position: 0,
      },
    });
    const financeTask = await tx.task.create({
      data: {
        project_id: project.id,
        company_id: project.company_id,
        title: "Onboarding: complete finance registration",
        description: "Fill legal company name, CNPJ, billing contact, payment terms, contract value, and start date.",
        status: "todo",
        priority: "high",
        assignee_id: financeOwner?.id ?? null,
        position: 1,
      },
    });
    const contractTask = await tx.task.create({
      data: {
        project_id: project.id,
        company_id: project.company_id,
        title: "Onboarding: upload signed contract",
        description: "Upload the signed contract privately so only Finance/Admin can access the file.",
        status: "todo",
        priority: "high",
        assignee_id: financeOwner?.id ?? null,
        position: 2,
      },
    });
    const supportTask = await tx.task.create({
      data: {
        project_id: project.id,
        company_id: project.company_id,
        title: "Onboarding: create client communication group",
        description: "Create the support/client communication group and record the link, participants, and notes.",
        status: "todo",
        priority: "medium",
        assignee_id: supportOwner?.id ?? null,
        position: 3,
      },
    });

    await tx.onboardingChecklistItem.createMany({
      data: [
        {
          onboarding_id: onboarding.id,
          workspace_id: project.workspace_id,
          task_id: commercialTask.id,
          department: "Commercial",
          title: "Project created and services selected",
          status: "complete",
          owner_id: salespersonId,
          completed_at: new Date(),
          completed_by: input.actorId,
          sort_order: 0,
        },
        {
          onboarding_id: onboarding.id,
          workspace_id: project.workspace_id,
          task_id: financeTask.id,
          department: "Finance",
          title: "Company registration completed",
          owner_id: financeOwner?.id ?? null,
          sort_order: 10,
        },
        {
          onboarding_id: onboarding.id,
          workspace_id: project.workspace_id,
          task_id: contractTask.id,
          department: "Contract",
          title: "Signed contract uploaded privately",
          owner_id: financeOwner?.id ?? null,
          sort_order: 20,
        },
        {
          onboarding_id: onboarding.id,
          workspace_id: project.workspace_id,
          department: "Internal Assignment",
          title: "Service leaders assigned",
          status: contractedServices.every((service) => mappingByService.get(serviceKey(service))?.leader_id)
            ? "complete"
            : "pending",
          completed_at: contractedServices.every((service) => mappingByService.get(serviceKey(service))?.leader_id)
            ? new Date()
            : null,
          completed_by: contractedServices.every((service) => mappingByService.get(serviceKey(service))?.leader_id)
            ? input.actorId
            : null,
          sort_order: 30,
        },
        {
          onboarding_id: onboarding.id,
          workspace_id: project.workspace_id,
          task_id: supportTask.id,
          department: "Support",
          title: "Client communication group created",
          owner_id: supportOwner?.id ?? null,
          sort_order: 40,
        },
      ],
    });

    await tx.supportGroup.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: project.workspace_id,
        created_by: supportOwner?.id ?? null,
      },
    });

    let position = 50;
    for (const service of contractedServices) {
      const mapping = mappingByService.get(serviceKey(service));
      const leaderId = mapping?.leader_id ?? null;
      const item = await tx.onboardingChecklistItem.create({
        data: {
          onboarding_id: onboarding.id,
          workspace_id: project.workspace_id,
          department: "Service Onboarding",
          title: `${service} onboarding meeting scheduled`,
          owner_id: leaderId,
          sort_order: position,
        },
      });
      await tx.onboardingServiceAssignment.create({
        data: {
          onboarding_id: onboarding.id,
          workspace_id: project.workspace_id,
          service,
          leader_id: leaderId,
          department_id: mapping?.department_id ?? supportDepartment?.id ?? null,
          department_name: mapping?.department?.name ?? null,
          status: leaderId ? "assigned" : "unassigned",
        },
      });
      await tx.onboardingMeeting.create({
        data: {
          onboarding_id: onboarding.id,
          workspace_id: project.workspace_id,
          service,
          checklist_item_id: item.id,
          leader_id: leaderId,
        },
      });
      position += 10;
    }

    const refreshed = await recomputeOnboardingProgress(tx, onboarding.id);
    return refreshed;
  }).then(async (onboarding) => {
    await recordActivity({
      workspace_id: onboarding.workspace_id,
      actor_id: input.actorId,
      type: "client_onboarding_started",
      entity_type: "client_onboarding",
      entity_id: onboarding.id,
      project_id: onboarding.project_id,
      company_id: onboarding.company_id,
      metadata: {
        status: onboarding.status,
        progress: onboarding.progress,
        services: onboarding.contracted_services,
      },
    });
    return onboarding;
  });
}

export function onboardingInclude() {
  return {
    company: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } },
    salesperson: { select: { id: true, name: true, email: true } },
    checklist_items: {
      orderBy: [{ sort_order: "asc" as const }, { created_at: "asc" as const }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        completer: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, title: true, status: true } },
      },
    },
    service_assignments: {
      orderBy: [{ service: "asc" as const }],
      include: {
        leader: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
      },
    },
    meetings: {
      orderBy: [{ service: "asc" as const }],
      include: {
        leader: { select: { id: true, name: true, email: true } },
      },
    },
    contracts: {
      orderBy: [{ uploaded_at: "desc" as const }, { id: "asc" as const }],
      include: {
        uploader: { select: { id: true, name: true, email: true } },
      },
    },
    support_group: {
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    },
  };
}

export async function recomputeOnboardingProgress(db: Db, onboardingId: string) {
  const onboarding = await db.clientOnboarding.findUnique({
    where: { id: onboardingId },
    include: {
      checklist_items: true,
      contracts: { select: { id: true } },
      support_group: true,
    },
  });
  if (!onboarding) throw new Error("Onboarding not found");

  const required = onboarding.checklist_items.filter((item) => item.required);
  const complete = required.filter((item) => item.status === "complete");
  const progress = required.length > 0 ? Math.round((complete.length / required.length) * 100) : 100;
  const next = required.find((item) => item.status !== "complete");
  const status = !next
    ? "onboarding_complete"
    : complete.length > 1
      ? "onboarding_in_progress"
      : departmentStatus(next.department);

  await db.clientOnboarding.update({
    where: { id: onboardingId },
    data: {
      progress,
      status,
      completed_at: status === "onboarding_complete" ? new Date() : null,
    },
  });

  return db.clientOnboarding.findUniqueOrThrow({
    where: { id: onboardingId },
    include: onboardingInclude(),
  });
}

export async function loadOnboardingAccess(auth: AuthUser, onboardingId: string) {
  const onboarding = await prisma.clientOnboarding.findUnique({
    where: { id: onboardingId },
    include: {
      service_assignments: { select: { service: true, leader_id: true } },
      checklist_items: { select: { id: true, department: true, owner_id: true } },
    },
  });
  if (!onboarding) return null;
  const admin = isWorkspaceAdminFor(auth, onboarding.workspace_id);
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspace_id_user_id: {
        workspace_id: onboarding.workspace_id,
        user_id: auth.prismaUser.id,
      },
    },
    include: { department: { select: { name: true } } },
  });
  const departmentName = member?.department?.name?.toLowerCase() ?? "";
  const isFinance = departmentName.includes("finance");
  const isSupport = departmentName.includes("support");
  const isCommercial = departmentName.includes("commercial") || onboarding.responsible_salesperson_id === auth.prismaUser.id;
  const serviceNames = onboarding.service_assignments
    .filter((assignment) => assignment.leader_id === auth.prismaUser.id)
    .map((assignment) => assignment.service);

  return {
    onboarding,
    admin,
    role: member?.role ?? null,
    isFinance,
    isSupport,
    isCommercial,
    serviceNames,
    canManage: admin,
    canViewPrivateContract: admin || isFinance,
    canUploadContract: admin || isFinance,
    canUpdateFinance: admin || isFinance,
    canUpdateSupport: admin || isSupport,
    canUpdateCommercial: admin || isCommercial,
    canUpdateService(service: string | null | undefined) {
      return admin || Boolean(service && serviceNames.map(serviceKey).includes(serviceKey(service)));
    },
    canUpdateChecklistItem(item: { department: string; owner_id?: string | null; title?: string | null }) {
      if (admin || item.owner_id === auth.prismaUser.id) return true;
      const department = item.department.toLowerCase();
      if (department.includes("finance") || department.includes("contract")) return isFinance;
      if (department.includes("support")) return isSupport;
      if (department.includes("commercial")) return isCommercial;
      if (department.includes("service")) {
        const service = item.title?.replace(/ onboarding meeting scheduled$/i, "");
        return this.canUpdateService(service);
      }
      return false;
    },
  };
}

export function redactOnboardingContracts<T extends { contracts?: Array<Record<string, unknown>> }>(
  onboarding: T,
  canViewPrivateContract: boolean,
) {
  if (canViewPrivateContract) return onboarding;
  return {
    ...onboarding,
    contracts: onboarding.contracts?.map((contract) => ({
      id: contract.id,
      onboarding_id: contract.onboarding_id,
      workspace_id: contract.workspace_id,
      company_id: contract.company_id,
      project_id: contract.project_id,
      file_name: contract.file_name,
      status: contract.status,
      visibility: contract.visibility,
      uploaded_by: contract.uploaded_by,
      uploaded_at: contract.uploaded_at,
      created_at: contract.created_at,
      uploader: contract.uploader,
      private: true,
    })),
  };
}

