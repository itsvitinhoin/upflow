import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth-helpers";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/activity";
import { logError } from "@/lib/log-error";
import { prisma } from "@/lib/prisma";
import { broadcastNotification } from "@/lib/supabase-server";

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

export const MARKETING_B2B_FORM_SERVICES = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "Pinterest Ads",
  "E-Commerce",
  "Up Zero",
  "Up Motion",
  "UP Motion v.1",
  "UP Motion v.2",
  "Implantacao IA",
] as const;

export const MARKETING_B2C_FORM_SERVICES = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "Pinterest Ads",
  "E-Commerce",
  "Nuvemshop",
  "Google Shopping",
  "Social Media",
  "Up Zero",
  "Up Motion",
  "UP Motion v.1",
  "UP Motion v.2",
  "Implantacao IA",
  "Influencers / UGC",
] as const;

type Tx = Prisma.TransactionClient;
type Db = typeof prisma | Tx;

type OnboardingTaskRoute =
  | "commercial"
  | "finance"
  | "support"
  | "marketing_b2b"
  | "marketing_b2c"
  | "creative_design";

type OnboardingTaskProjectInput = {
  workspaceId: string;
  companyId?: string | null;
  companyName?: string;
  sourceProjectId?: string | null;
  sourceProjectSpaceId?: string | null;
  ownerId: string;
  route: OnboardingTaskRoute | null;
};

type UserRef = { id: string; name: string; email: string };

type CompanySnapshot = {
  id: string;
  workspace_id: string;
  name: string;
  owner_id: string;
  included_services: Prisma.JsonValue | null;
  service_type: string | null;
  plan_name: string | null;
};

type SourceProjectSnapshot = {
  id: string;
  name: string;
  workspace_id: string;
  space_id: string | null;
  company_id: string | null;
  owner_id: string;
  closing_date: Date | null;
  onboarding_start_date: Date | null;
  responsible_salesperson_id: string | null;
  initial_notes: string | null;
  space?: {
    id: string;
    name: string;
  } | null;
};

type CreatedOnboardingTask = {
  id: string;
  title: string;
  route: OnboardingTaskRoute;
  project_id: string;
  assignee_id: string | null;
};

type OnboardingCreationResult = {
  onboarding: Awaited<ReturnType<typeof recomputeOnboardingProgress>>;
  notificationTargets: OnboardingAssignmentNotificationTarget[];
  createdTasks: CreatedOnboardingTask[];
  missingMappings: string[];
  reused: boolean;
};

export type ClientOnboardingWizardInput = {
  workspaceId: string;
  actorId: string;
  companyId?: string | null;
  name: string;
  website?: string | null;
  industry?: string | null;
  serviceType?: string | null;
  planName?: string | null;
  billingCycle?: string | null;
  includedServices: string[];
  notes?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactRole?: string | null;
  ownerId?: string | null;
  expectedStartDate?: Date | null;
  closingDate?: Date | null;
  initialNotes?: string | null;
  responsibleSalespersonId?: string | null;
  responsibleDepartmentId?: string | null;
  responsibleDepartmentName?: string | null;
  contractValue?: number | null;
};

export type ClientOnboardingWizardResult = {
  company_id: string;
  onboarding_id: string;
  redirect_url: string;
  created_tasks: CreatedOnboardingTask[];
  notifications: number;
  missing_mappings: string[];
};

export type OnboardingAssignmentNotificationTarget = {
  userId: string | null | undefined;
  taskId: string;
  workspaceId: string;
  onboardingId: string;
  actorId: string;
  label: string;
  companyId?: string | null;
};

const ONBOARDING_SAFE_SCALAR_SELECT = {
  id: true,
  workspace_id: true,
  company_id: true,
  project_id: true,
  status: true,
  progress: true,
  closing_date: true,
  expected_start_date: true,
  responsible_salesperson_id: true,
  initial_notes: true,
  contracted_services: true,
  completed_at: true,
  created_by: true,
  created_at: true,
  updated_at: true,
} as const satisfies Prisma.ClientOnboardingSelect;

const ROUTE_SPACE_ALIASES: Record<OnboardingTaskRoute, string[]> = {
  commercial: ["commercial", "comercial"],
  finance: ["finance", "financial", "financeiro"],
  support: ["support", "technical support", "suporte", "suporte tecnico"],
  marketing_b2b: ["marketing b2b", "paid media", "media buying", "marketing"],
  marketing_b2c: ["marketing b2c", "consumer marketing", "b2c", "varejo", "ecommerce"],
  creative_design: ["creative and design", "creative design", "creative & design", "criativo", "design"],
};

const ROUTE_QUEUE_CONFIG: Record<
  OnboardingTaskRoute,
  { spaceName: string; projectName: string; description: string; aliases: string[] }
> = {
  commercial: {
    spaceName: "Commercial",
    projectName: "Contracts & Handoffs",
    description: "Reusable queue for client contracts, handoffs, and onboarding commercial checks.",
    aliases: ROUTE_SPACE_ALIASES.commercial,
  },
  finance: {
    spaceName: "Finance",
    projectName: "Client Onboarding",
    description: "Reusable queue for finance registration and billing onboarding tasks.",
    aliases: ROUTE_SPACE_ALIASES.finance,
  },
  support: {
    spaceName: "Support",
    projectName: "Client Channels",
    description: "Reusable queue for support group and client communication setup.",
    aliases: ROUTE_SPACE_ALIASES.support,
  },
  marketing_b2b: {
    spaceName: "Marketing B2B",
    projectName: "Service Onboarding",
    description: "Reusable queue for paid media, tracking, reporting, and marketing service kickoff tasks.",
    aliases: ROUTE_SPACE_ALIASES.marketing_b2b,
  },
  marketing_b2c: {
    spaceName: "Marketing B2C",
    projectName: "Service Onboarding",
    description: "Reusable queue for consumer marketing, e-commerce, traffic, and B2C onboarding tasks.",
    aliases: ROUTE_SPACE_ALIASES.marketing_b2c,
  },
  creative_design: {
    spaceName: "Creative & Design",
    projectName: "Service Onboarding",
    description: "Reusable queue for creative, video, website, and design service kickoff tasks.",
    aliases: ROUTE_SPACE_ALIASES.creative_design,
  },
};

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

export function financeRegistrationComplete(company: {
  legal_name: string | null;
  cnpj: string | null;
  billing_email: string | null;
  main_contact_email: string | null;
  contract_value: number | null;
  payment_terms: string | null;
  contract_start_date: Date | null;
}) {
  return Boolean(
    company.legal_name &&
      company.cnpj &&
      company.billing_email &&
      company.main_contact_email &&
      company.contract_value != null &&
      company.payment_terms &&
      company.contract_start_date,
  );
}

export async function getOnboardingCompletionBlocker(
  db: Db,
  onboardingId: string,
  item: { id: string; department: string },
) {
  const department = item.department.toLowerCase();

  if (department.includes("finance")) {
    const onboarding = await db.clientOnboarding.findUnique({
      where: { id: onboardingId },
      select: {
        company: {
          select: {
            legal_name: true,
            cnpj: true,
            billing_email: true,
            main_contact_email: true,
            contract_value: true,
            payment_terms: true,
            contract_start_date: true,
          },
        },
      },
    });
    if (!onboarding?.company || !financeRegistrationComplete(onboarding.company)) {
      return "Complete the finance registration fields before marking Finance done.";
    }
  }

  if (department.includes("contract")) {
    const contractCount = await db.clientContract.count({ where: { onboarding_id: onboardingId } });
    if (contractCount === 0) return "Upload a private contract before marking Contract done.";
  }

  if (department.includes("support")) {
    const support = await db.supportGroup.findUnique({
      where: { onboarding_id: onboardingId },
      select: { group_created: true },
    });
    if (!support?.group_created) return "Create the support group before marking Support done.";
  }

  if (department.includes("internal")) {
    const missingLeader = await db.onboardingServiceAssignment.findFirst({
      where: {
        onboarding_id: onboardingId,
        OR: [{ leader_id: null }, { status: "needs_mapping" }],
      },
      select: { id: true },
    });
    if (missingLeader) return "Assign leaders for every contracted service before marking Internal Assignment done.";
  }

  if (department.includes("marketing b2b")) {
    const form = await db.marketingB2BOnboardingForm.findUnique({
      where: { checklist_item_id: item.id },
      select: { status: true },
    });
    if (form?.status !== "complete") {
      return "Finalize the Marketing B2B onboarding form before marking this task done.";
    }
  }

  if (department.includes("marketing b2c")) {
    const form = await db.marketingB2COnboardingForm.findUnique({
      where: { checklist_item_id: item.id },
      select: { status: true },
    });
    if (form?.status !== "complete") {
      return "Finalize the Marketing B2C onboarding form before marking this task done.";
    }
  }

  if (department.includes("service")) {
    const meeting = await db.onboardingMeeting.findFirst({
      where: { onboarding_id: onboardingId, checklist_item_id: item.id },
      select: { scheduled: true },
    });
    if (!meeting?.scheduled) return "Schedule the onboarding meeting before marking this service done.";
  }

  return null;
}

export async function getOnboardingTaskCompletionBlocker(db: Db, taskId: string) {
  const item = await db.onboardingChecklistItem.findFirst({
    where: { task_id: taskId },
    select: { id: true, onboarding_id: true, department: true },
  });
  if (!item) return null;
  return getOnboardingCompletionBlocker(db, item.onboarding_id, item);
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

function normalizedName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function isMarketingB2BFormService(service: string) {
  const key = normalizedName(service);
  return (
    key === "meta ads" ||
    key === "google ads" ||
    key === "tiktok ads" ||
    key === "pinterest ads" ||
    key === "e commerce" ||
    key === "ecommerce" ||
    key === "up zero" ||
    key === "up motion" ||
    key.startsWith("up motion ") ||
    key === "implantacao ia" ||
    key === "implementacao ia" ||
    key === "ai implementation"
  );
}

export function isMarketingB2CFormService(service: string) {
  const key = normalizedName(service);
  return (
    key === "meta ads" ||
    key === "google ads" ||
    key === "tiktok ads" ||
    key === "pinterest ads" ||
    key === "e commerce" ||
    key === "ecommerce" ||
    key === "nuvemshop" ||
    key === "google shopping" ||
    key === "social media" ||
    key === "up zero" ||
    key === "up motion" ||
    key.startsWith("up motion ") ||
    key === "implantacao ia" ||
    key === "implementacao ia" ||
    key === "ai implementation" ||
    key.includes("influencer") ||
    key.includes("ugc") ||
    key.includes("marketing b2c") ||
    key.includes("consumer marketing") ||
    key.includes("content calendar") ||
    key.includes("calendario de conteudo") ||
    key.includes("promotions") ||
    key.includes("promocoes") ||
    key.includes("campaigns") ||
    key.includes("campanhas") ||
    key === "ads" ||
    key.includes("trafego") ||
    key.includes("midia")
  );
}

function isMarketingB2BDepartment(value: string | null | undefined) {
  const key = normalizedName(value ?? "");
  return key.includes("marketing b2b");
}

function isMarketingB2CDepartment(value: string | null | undefined) {
  const key = normalizedName(value ?? "");
  return key.includes("marketing b2c") || key === "b2c" || key.includes("consumer marketing");
}

function routeForResponsibleDepartment(value: string | null | undefined): OnboardingTaskRoute | null {
  if (isMarketingB2CDepartment(value)) return "marketing_b2c";
  if (isMarketingB2BDepartment(value)) return "marketing_b2b";
  const key = normalizedName(value ?? "");
  if (key.includes("creative") || key.includes("design")) return "creative_design";
  if (key.includes("finance") || key.includes("financeiro")) return "finance";
  if (key.includes("support") || key.includes("suporte")) return "support";
  if (key.includes("commercial") || key.includes("comercial") || key.includes("sales")) return "commercial";
  return null;
}

export function routeForService(service: string): OnboardingTaskRoute | null {
  const key = normalizedName(service);
  if (
    key.includes("nuvemshop") ||
    key.includes("google shopping") ||
    key.includes("influencer") ||
    key.includes("ugc") ||
    key.includes("marketing b2c") ||
    key.includes("consumer marketing") ||
    key.includes("content calendar") ||
    key.includes("calendario de conteudo") ||
    key.includes("promotions") ||
    key.includes("promocoes") ||
    key.includes("campaigns") ||
    key.includes("campanhas") ||
    key === "ads" ||
    key.includes("trafego") ||
    key.includes("midia")
  ) {
    return "marketing_b2c";
  }
  if (
    key.includes("creative") ||
    key.includes("video") ||
    key.includes("website") ||
    key.includes("web design") ||
    key.includes("landing page")
  ) {
    return "creative_design";
  }
  if (
    key.includes("meta ads") ||
    key.includes("google ads") ||
    key.includes("e commerce") ||
    key.includes("ecommerce") ||
    key.includes("up zero") ||
    key.includes("up motion") ||
    key.includes("paid media") ||
    key.includes("social") ||
    key.includes("seo") ||
    key.includes("tracking") ||
    key.includes("analytics") ||
    key.includes("email") ||
    key.includes("monthly report") ||
    key.includes("content")
  ) {
    return "marketing_b2b";
  }
  if (key.includes("support")) return "support";
  return null;
}

function routeMatcher(route: OnboardingTaskRoute) {
  return ROUTE_QUEUE_CONFIG[route].aliases.map((alias) => normalizedName(alias));
}

async function findTargetSpace(db: Db, workspaceId: string, route: OnboardingTaskRoute) {
  const spaces = await db.space.findMany({
    where: { workspace_id: workspaceId },
    select: { id: true, name: true },
  });
  const aliases = routeMatcher(route);
  return (
    spaces.find((space) => aliases.includes(normalizedName(space.name))) ??
    spaces.find((space) => {
      const name = normalizedName(space.name);
      return aliases.some((alias) => name.includes(alias) || alias.includes(name));
    }) ??
    null
  );
}

async function ensureTargetSpace(db: Db, workspaceId: string, route: OnboardingTaskRoute, ownerId: string) {
  const existing = await findTargetSpace(db, workspaceId, route);
  if (existing) return existing;
  const config = ROUTE_QUEUE_CONFIG[route];
  return db.space.create({
    data: {
      workspace_id: workspaceId,
      owner_id: ownerId,
      name: config.spaceName,
      icon: null,
    },
    select: { id: true, name: true },
  });
}

export async function resolveOnboardingTaskProjectId(
  db: Db,
  input: OnboardingTaskProjectInput,
): Promise<string> {
  const route = input.route ?? "commercial";
  const config = ROUTE_QUEUE_CONFIG[route];
  const targetSpace = await ensureTargetSpace(db, input.workspaceId, route, input.ownerId);

  const existingProject = await db.project.findFirst({
    where: {
      workspace_id: input.workspaceId,
      space_id: targetSpace.id,
      company_id: null,
      name: config.projectName,
    },
    select: { id: true },
  });
  if (existingProject) return existingProject.id;

  const createdProject = await db.project.create({
    data: {
      name: config.projectName,
      description: config.description,
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      space_id: targetSpace.id,
      company_id: null,
    },
    select: { id: true },
  });
  return createdProject.id;
}

async function ensureFolder(
  db: Db,
  input: {
    workspaceId: string;
    spaceId: string;
    ownerId: string;
    name: string;
    parentId?: string | null;
    icon?: string | null;
  },
) {
  const existing = await db.folder.findFirst({
    where: {
      workspace_id: input.workspaceId,
      space_id: input.spaceId,
      parent_id: input.parentId ?? null,
      name: { equals: input.name, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  return db.folder.create({
    data: {
      workspace_id: input.workspaceId,
      space_id: input.spaceId,
      owner_id: input.ownerId,
      parent_id: input.parentId ?? null,
      name: input.name,
      icon: input.icon ?? null,
    },
    select: { id: true, name: true },
  });
}

export async function resolveMarketingB2BOnboardingProjectId(
  db: Db,
  input: {
    workspaceId: string;
    companyId: string;
    companyName: string;
    ownerId: string;
  },
): Promise<string> {
  const targetSpace = await ensureTargetSpace(db, input.workspaceId, "marketing_b2b", input.ownerId);
  const onboardingFolder = await ensureFolder(db, {
    workspaceId: input.workspaceId,
    spaceId: targetSpace.id,
    ownerId: input.ownerId,
    name: "Onboarding",
    parentId: null,
    icon: "folder",
  });
  const clientFolder = await ensureFolder(db, {
    workspaceId: input.workspaceId,
    spaceId: targetSpace.id,
    ownerId: input.ownerId,
    name: input.companyName,
    parentId: onboardingFolder.id,
    icon: "folder",
  });

  const projectName = input.companyName.trim() || "Marketing B2B Onboarding";
  const existingProject = await db.project.findFirst({
    where: {
      workspace_id: input.workspaceId,
      space_id: targetSpace.id,
      folder_id: clientFolder.id,
      company_id: input.companyId,
      name: projectName,
    },
    select: { id: true },
  });
  if (existingProject) return existingProject.id;

  const legacyProject = await db.project.findFirst({
    where: {
      workspace_id: input.workspaceId,
      space_id: targetSpace.id,
      folder_id: clientFolder.id,
      company_id: input.companyId,
      name: "Marketing B2B Onboarding",
    },
    select: { id: true },
  });
  if (legacyProject) {
    const renamed = await db.project.update({
      where: { id: legacyProject.id },
      data: { name: projectName },
      select: { id: true },
    });
    return renamed.id;
  }

  const createdProject = await db.project.create({
    data: {
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      space_id: targetSpace.id,
      folder_id: clientFolder.id,
      company_id: input.companyId,
      name: projectName,
      description:
        "Marketing B2B onboarding form and execution tasks for this client.",
    },
    select: { id: true },
  });
  return createdProject.id;
}

export async function resolveMarketingB2COnboardingProjectId(
  db: Db,
  input: {
    workspaceId: string;
    companyId: string;
    companyName: string;
    ownerId: string;
  },
): Promise<string> {
  const targetSpace = await ensureTargetSpace(db, input.workspaceId, "marketing_b2c", input.ownerId);
  const onboardingFolder = await ensureFolder(db, {
    workspaceId: input.workspaceId,
    spaceId: targetSpace.id,
    ownerId: input.ownerId,
    name: "Onboarding",
    parentId: null,
    icon: "folder",
  });
  const clientFolder = await ensureFolder(db, {
    workspaceId: input.workspaceId,
    spaceId: targetSpace.id,
    ownerId: input.ownerId,
    name: input.companyName,
    parentId: onboardingFolder.id,
    icon: "folder",
  });

  const projectName = input.companyName.trim() || "Marketing B2C Onboarding";
  const legacyProjectName = "Marketing B2C Onboarding";
  const existingProject = await db.project.findFirst({
    where: {
      workspace_id: input.workspaceId,
      space_id: targetSpace.id,
      folder_id: clientFolder.id,
      company_id: input.companyId,
      name: projectName,
    },
    select: { id: true },
  });
  if (existingProject) return existingProject.id;

  if (projectName !== legacyProjectName) {
    const legacyProject = await db.project.findFirst({
      where: {
        workspace_id: input.workspaceId,
        space_id: targetSpace.id,
        folder_id: clientFolder.id,
        company_id: input.companyId,
        name: legacyProjectName,
      },
      select: { id: true },
    });
    if (legacyProject) {
      const renamedProject = await db.project.update({
        where: { id: legacyProject.id },
        data: { name: projectName },
        select: { id: true },
      });
      return renamedProject.id;
    }
  }

  const createdProject = await db.project.create({
    data: {
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      space_id: targetSpace.id,
      folder_id: clientFolder.id,
      company_id: input.companyId,
      name: projectName,
      description:
        "Marketing B2C onboarding form and execution tasks for this client.",
    },
    select: { id: true },
  });
  return createdProject.id;
}

async function resolveDepartmentClientOnboardingProjectId(
  db: Db,
  input: {
    workspaceId: string;
    companyId: string;
    companyName: string;
    ownerId: string;
    route: "finance" | "creative_design";
    rootFolderName: string;
    fallbackProjectName: string;
    description: string;
  },
): Promise<string> {
  const targetSpace = await ensureTargetSpace(db, input.workspaceId, input.route, input.ownerId);
  const onboardingFolder = await ensureFolder(db, {
    workspaceId: input.workspaceId,
    spaceId: targetSpace.id,
    ownerId: input.ownerId,
    name: input.rootFolderName,
    parentId: null,
    icon: "folder",
  });
  const clientFolder = await ensureFolder(db, {
    workspaceId: input.workspaceId,
    spaceId: targetSpace.id,
    ownerId: input.ownerId,
    name: input.companyName,
    parentId: onboardingFolder.id,
    icon: "folder",
  });

  const projectName = input.companyName.trim() || input.fallbackProjectName;
  const existingProject = await db.project.findFirst({
    where: {
      workspace_id: input.workspaceId,
      space_id: targetSpace.id,
      folder_id: clientFolder.id,
      company_id: input.companyId,
      name: projectName,
    },
    select: { id: true },
  });
  if (existingProject) return existingProject.id;

  const createdProject = await db.project.create({
    data: {
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      space_id: targetSpace.id,
      folder_id: clientFolder.id,
      company_id: input.companyId,
      name: projectName,
      description: input.description,
    },
    select: { id: true },
  });
  return createdProject.id;
}

export async function resolveFinanceOnboardingProjectId(
  db: Db,
  input: {
    workspaceId: string;
    companyId: string;
    companyName: string;
    ownerId: string;
  },
): Promise<string> {
  return resolveDepartmentClientOnboardingProjectId(db, {
    ...input,
    route: "finance",
    rootFolderName: "Client Onboarding",
    fallbackProjectName: "Finance Onboarding",
    description: "Finance onboarding form, contract attachment, and billing setup for this client.",
  });
}

export async function resolveCreativeDesignOnboardingProjectId(
  db: Db,
  input: {
    workspaceId: string;
    companyId: string;
    companyName: string;
    ownerId: string;
  },
): Promise<string> {
  return resolveDepartmentClientOnboardingProjectId(db, {
    ...input,
    route: "creative_design",
    rootFolderName: "Client Onboarding",
    fallbackProjectName: "Creative Onboarding",
    description: "Creative and design onboarding scheduling tasks for this client.",
  });
}

export async function sendOnboardingAssignmentNotifications(targets: OnboardingAssignmentNotificationTarget[]) {
  const uniqueTargets = new Map<string, OnboardingAssignmentNotificationTarget>();
  for (const target of targets) {
    if (!target.userId || target.userId === target.actorId) continue;
    uniqueTargets.set(`${target.userId}:${target.taskId}`, target);
  }

  let sent = 0;
  for (const target of uniqueTargets.values()) {
    await prisma.notification
      .create({
        data: {
          type: "assigned",
          user_id: target.userId!,
          task_id: target.taskId,
          workspace_id: target.workspaceId,
          data: {
            source: "client_onboarding",
            onboarding_id: target.onboardingId,
            company_id: target.companyId,
            label: target.label,
            task_title: target.label,
          },
        },
      })
      .then(() => {
        sent += 1;
      })
      .catch((err) =>
        logError("onboarding:assignment-notify", err, {
          task_id: target.taskId,
          user_id: target.userId,
          onboarding_id: target.onboardingId,
        }),
      );
    await broadcastNotification(target.userId!).catch((err) =>
      logError("onboarding:assignment-broadcast", err, {
        task_id: target.taskId,
        user_id: target.userId,
        onboarding_id: target.onboardingId,
      }),
    );
  }
  return sent;
}

async function sendOnboardingAdminSummaryNotifications(input: {
  workspaceId: string;
  actorId: string;
  onboardingId: string;
  companyId: string;
  companyName: string;
  createdTaskCount: number;
  missingMappings: string[];
}) {
  const admins = await prisma.workspaceMember.findMany({
    where: {
      workspace_id: input.workspaceId,
      status: "active",
      role: { in: ["owner", "admin"] },
      user_id: { not: input.actorId },
    },
    select: { user_id: true },
  });
  if (admins.length === 0) return 0;

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      type: "assigned" as const,
      user_id: admin.user_id,
      workspace_id: input.workspaceId,
      data: {
        source: "client_onboarding_summary",
        onboarding_id: input.onboardingId,
        company_id: input.companyId,
        task_title: `Onboarding started: ${input.companyName}`,
        label: `Onboarding started for ${input.companyName}`,
        created_task_count: input.createdTaskCount,
        missing_mappings: input.missingMappings,
      },
    })),
  });
  await Promise.all(
    admins.map((admin) =>
      broadcastNotification(admin.user_id).catch((err) =>
        logError("onboarding:admin-summary-broadcast", err, {
          user_id: admin.user_id,
          onboarding_id: input.onboardingId,
        }),
      ),
    ),
  );
  return admins.length;
}

async function findAdminFallback(db: Db, workspaceId: string): Promise<UserRef | null> {
  const member = await db.workspaceMember.findFirst({
    where: {
      workspace_id: workspaceId,
      status: "active",
      role: { in: ["owner", "admin"] },
    },
    orderBy: [{ role: "asc" }, { created_at: "asc" }],
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  if (member?.user) return member.user;

  const anyMember = await db.workspaceMember.findFirst({
    where: {
      workspace_id: workspaceId,
      status: "active",
      role: { not: "guest" },
    },
    orderBy: [{ created_at: "asc" }],
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  return anyMember?.user ?? null;
}

async function findDepartmentOwner(db: Db, workspaceId: string, route: OnboardingTaskRoute): Promise<UserRef | null> {
  const aliases = ROUTE_QUEUE_CONFIG[route].aliases;
  const member = await db.workspaceMember.findFirst({
    where: {
      workspace_id: workspaceId,
      status: "active",
      role: { not: "guest" },
      OR: aliases.map((alias) => ({
        department: { name: { contains: alias, mode: "insensitive" as const } },
      })),
    },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  return member?.user ?? null;
}

async function findDepartmentByRoute(db: Db, workspaceId: string, route: OnboardingTaskRoute) {
  const aliases = ROUTE_QUEUE_CONFIG[route].aliases;
  return db.department.findFirst({
    where: {
      workspace_id: workspaceId,
      OR: aliases.map((alias) => ({ name: { contains: alias, mode: "insensitive" as const } })),
    },
    select: { id: true, name: true },
  });
}

async function ownerForRoute(
  db: Db,
  workspaceId: string,
  route: OnboardingTaskRoute,
  fallback: UserRef | null,
) {
  return (await findDepartmentOwner(db, workspaceId, route)) ?? fallback;
}

async function departmentForRoute(db: Db, workspaceId: string, route: OnboardingTaskRoute) {
  return findDepartmentByRoute(db, workspaceId, route);
}

function onboardingServices(input: {
  explicitServices?: string[];
  includedServices?: Prisma.JsonValue | null;
  serviceType?: string | null;
}) {
  const services = uniqueStrings([
    ...(input.explicitServices ?? []),
    ...parseContractedServices(input.includedServices),
    input.serviceType,
  ]);
  return services.length ? services : ["General onboarding"];
}

function cleanNullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

async function createOnboardingRecords(
  tx: Tx,
  input: {
    company: CompanySnapshot;
    sourceProject?: SourceProjectSnapshot | null;
    actorId: string;
    services?: string[];
    closingDate?: Date | null;
    expectedStartDate?: Date | null;
    initialNotes?: string | null;
    responsibleSalespersonId?: string | null;
    responsibleDepartmentId?: string | null;
    responsibleDepartmentName?: string | null;
  },
): Promise<OnboardingCreationResult> {
  const company = input.company;
  const sourceProject = input.sourceProject ?? null;

  const existing = sourceProject
    ? await tx.clientOnboarding.findUnique({
        where: { project_id: sourceProject.id },
        select: onboardingSelect(),
      })
    : await tx.clientOnboarding.findFirst({
        where: {
          workspace_id: company.workspace_id,
          company_id: company.id,
          status: { not: "onboarding_complete" },
        },
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        select: onboardingSelect(),
      });
  if (existing) {
    return {
      onboarding: existing,
      notificationTargets: [],
      createdTasks: [],
      missingMappings: [],
      reused: true,
    };
  }

  const notificationTargets: OnboardingAssignmentNotificationTarget[] = [];
  const createdTasks: CreatedOnboardingTask[] = [];
  const missingMappings: string[] = [];
  const contractedServices = onboardingServices({
    explicitServices: input.services,
    includedServices: company.included_services,
    serviceType: company.service_type,
  });
  const responsibleDepartment = input.responsibleDepartmentName
    ? null
    : input.responsibleDepartmentId
      ? await tx.department.findFirst({
          where: { id: input.responsibleDepartmentId, workspace_id: company.workspace_id },
          select: { name: true },
        })
      : null;
  const sourceProjectSpaceName = sourceProject?.space?.name ?? null;
  const responsibleDepartmentName = input.responsibleDepartmentName ?? responsibleDepartment?.name ?? sourceProjectSpaceName ?? null;
  const responsibleDepartmentRoute = routeForResponsibleDepartment(responsibleDepartmentName);
  const responsibleIsB2C = responsibleDepartmentRoute === "marketing_b2c";

  const mappingRows = await tx.serviceLeaderMapping.findMany({
    where: { workspace_id: company.workspace_id, active: true },
    include: {
      department: { select: { id: true, name: true } },
      leader: { select: { id: true, name: true, email: true } },
    },
  });
  const mappingByService = new Map(mappingRows.map((mapping) => [serviceKey(mapping.service), mapping]));
  const adminFallback = await findAdminFallback(tx, company.workspace_id);
  const financeOwner = await ownerForRoute(tx, company.workspace_id, "finance", adminFallback);
  const supportOwner = await ownerForRoute(tx, company.workspace_id, "support", adminFallback);
  const commercialOwner = await ownerForRoute(tx, company.workspace_id, "commercial", adminFallback);
  const creativeOwner = await ownerForRoute(tx, company.workspace_id, "creative_design", adminFallback);
  const salespersonId =
    input.responsibleSalespersonId ??
    sourceProject?.responsible_salesperson_id ??
    commercialOwner?.id ??
    sourceProject?.owner_id ??
    company.owner_id;

  const queueProjectCache = new Map<OnboardingTaskRoute, string>();
  const queueProjectId = async (route: OnboardingTaskRoute | null) => {
    const resolvedRoute = route ?? "commercial";
    const cached = queueProjectCache.get(resolvedRoute);
    if (cached) return cached;
    const projectId = await resolveOnboardingTaskProjectId(tx, {
      workspaceId: company.workspace_id,
      companyId: company.id,
      companyName: company.name,
      sourceProjectId: sourceProject?.id ?? null,
      sourceProjectSpaceId: sourceProject?.space_id ?? null,
      ownerId: input.actorId,
      route: resolvedRoute,
    });
    queueProjectCache.set(resolvedRoute, projectId);
    return projectId;
  };

  const commercialProjectId = await queueProjectId("commercial");
  const financeProjectId = await resolveFinanceOnboardingProjectId(tx, {
    workspaceId: company.workspace_id,
    companyId: company.id,
    companyName: company.name,
    ownerId: input.actorId,
  });
  const supportProjectId = await queueProjectId("support");
  const creativeProjectId = await resolveCreativeDesignOnboardingProjectId(tx, {
    workspaceId: company.workspace_id,
    companyId: company.id,
    companyName: company.name,
    ownerId: input.actorId,
  });

  const onboarding = await tx.clientOnboarding.create({
    data: {
      workspace_id: company.workspace_id,
      company_id: company.id,
      project_id: sourceProject?.id ?? null,
      status: "pending_finance_registration",
      progress: 0,
      closing_date: input.closingDate ?? sourceProject?.closing_date ?? null,
      expected_start_date: input.expectedStartDate ?? sourceProject?.onboarding_start_date ?? null,
      responsible_salesperson_id: salespersonId,
      initial_notes: input.initialNotes ?? sourceProject?.initial_notes ?? null,
      contracted_services: contractedServices,
      created_by: input.actorId,
    },
    select: ONBOARDING_SAFE_SCALAR_SELECT,
  });

  if (sourceProject) {
    await tx.project.update({
      where: { id: sourceProject.id },
      data: {
        onboarding_enabled: true,
        responsible_salesperson_id: salespersonId,
        ...(input.closingDate !== undefined && { closing_date: input.closingDate }),
        ...(input.expectedStartDate !== undefined && { onboarding_start_date: input.expectedStartDate }),
        ...(input.initialNotes !== undefined && { initial_notes: input.initialNotes }),
      },
    });
  }

  const createTask = async (data: {
    project_id: string;
    route: OnboardingTaskRoute;
    title: string;
    description: string;
    status: "todo" | "in_progress" | "done";
    priority: "low" | "medium" | "high";
    assignee_id: string | null;
    position: number;
  }) => {
    const task = await tx.task.create({
      data: {
        project_id: data.project_id,
        company_id: company.id,
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assignee_id: data.assignee_id,
        position: data.position,
      },
    });
    createdTasks.push({
      id: task.id,
      title: task.title,
      route: data.route,
      project_id: data.project_id,
      assignee_id: task.assignee_id,
    });
    return task;
  };

  const commercialTask = await createTask({
    project_id: commercialProjectId,
    route: "commercial",
    title: "Onboarding: commercial setup confirmed",
    description: "Client created with services, owner, expected start, and initial onboarding notes.",
    status: "done",
    priority: "high",
    assignee_id: salespersonId,
    position: 0,
  });
  const financeTask = await createTask({
    project_id: financeProjectId,
    route: "finance",
    title: "Onboarding: complete finance registration",
    description:
      "Finance queue action: fill legal company name, CNPJ, billing contact, payment terms, contract value, and start date. When this task is marked done, the onboarding checklist and progress update automatically.",
    status: "todo",
    priority: "high",
    assignee_id: financeOwner?.id ?? null,
    position: 1,
  });
  const contractTask = await createTask({
    project_id: financeProjectId,
    route: "finance",
    title: "Onboarding: upload signed contract",
    description:
      "Finance queue action: upload the signed contract inside the finance onboarding form so only Finance/Admin can access the file. When this task is marked done, the onboarding checklist and progress update automatically.",
    status: "todo",
    priority: "high",
    assignee_id: financeOwner?.id ?? null,
    position: 2,
  });
  const supportTask = await createTask({
    project_id: supportProjectId,
    route: "support",
    title: "Onboarding: create client communication group",
    description:
      "Support queue action: create the support/client communication group and record the link, participants, and notes. When this task is marked done, the onboarding checklist and progress update automatically.",
    status: "todo",
    priority: "medium",
    assignee_id: supportOwner?.id ?? null,
    position: 3,
  });
  const creativeBrandMeetingTask = await createTask({
    project_id: creativeProjectId,
    route: "creative_design",
    title: "Onboarding: schedule brand guidelines meeting",
    description:
      "Creative & Design queue action: schedule the first client meeting to discuss brand guidelines, visual direction, references, assets, and creative handoff.",
    status: "todo",
    priority: "medium",
    assignee_id: creativeOwner?.id ?? null,
    position: 4,
  });
  const creativeTechnicalVisitTask = await createTask({
    project_id: creativeProjectId,
    route: "creative_design",
    title: "Onboarding: schedule visita tecnica",
    description:
      "Creative & Design queue action: schedule the visita tecnica with the client and link the calendar event back to onboarding.",
    status: "todo",
    priority: "medium",
    assignee_id: creativeOwner?.id ?? null,
    position: 5,
  });

  notificationTargets.push(
    {
      userId: financeOwner?.id,
      taskId: financeTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Finance registration for ${company.name}`,
      companyId: company.id,
    },
    {
      userId: financeOwner?.id,
      taskId: contractTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Upload signed contract for ${company.name}`,
      companyId: company.id,
    },
    {
      userId: supportOwner?.id,
      taskId: supportTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Create support group for ${company.name}`,
      companyId: company.id,
    },
    {
      userId: creativeOwner?.id,
      taskId: creativeBrandMeetingTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Schedule brand guidelines meeting for ${company.name}`,
      companyId: company.id,
    },
    {
      userId: creativeOwner?.id,
      taskId: creativeTechnicalVisitTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Schedule visita tecnica for ${company.name}`,
      companyId: company.id,
    },
  );

  const allMapped = contractedServices.every((service) => mappingByService.get(serviceKey(service))?.leader_id);
  await tx.onboardingChecklistItem.createMany({
    data: [
      {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: commercialTask.id,
        department: "Commercial",
        title: "Client created and services selected",
        status: "complete",
        owner_id: salespersonId,
        completed_at: new Date(),
        completed_by: input.actorId,
        sort_order: 0,
      },
      {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: financeTask.id,
        department: "Finance",
        title: "Company registration completed",
        owner_id: financeOwner?.id ?? null,
        sort_order: 10,
      },
      {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: contractTask.id,
        department: "Contract",
        title: "Signed contract uploaded privately",
        owner_id: financeOwner?.id ?? null,
        sort_order: 20,
      },
      {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        department: "Internal Assignment",
        title: "Service leaders assigned",
        status: allMapped ? "complete" : "pending",
        completed_at: allMapped ? new Date() : null,
        completed_by: allMapped ? input.actorId : null,
        notes: allMapped ? null : "One or more services are using fallback owners and need service leader mapping.",
        sort_order: 30,
      },
      {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: supportTask.id,
        department: "Support",
        title: "Client communication group created",
        owner_id: supportOwner?.id ?? null,
        sort_order: 40,
      },
      {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: creativeBrandMeetingTask.id,
        department: "Creative & Design",
        title: "Brand guidelines meeting scheduled",
        owner_id: creativeOwner?.id ?? null,
        sort_order: 50,
      },
      {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: creativeTechnicalVisitTask.id,
        department: "Creative & Design",
        title: "Visita tecnica scheduled",
        owner_id: creativeOwner?.id ?? null,
        sort_order: 60,
      },
    ],
  });

  await tx.supportGroup.create({
    data: {
      onboarding_id: onboarding.id,
      workspace_id: company.workspace_id,
      created_by: supportOwner?.id ?? null,
    },
  });

  let position = 70;
  const b2bFormServices = responsibleIsB2C ? [] : contractedServices.filter(isMarketingB2BFormService);
  const b2bFormServiceKeys = new Set(b2bFormServices.map(serviceKey));
  const b2bAssignments: Array<{
    service: string;
    leaderId: string | null;
    departmentId: string | null;
    departmentName: string | null;
    needsMapping: boolean;
  }> = [];

  for (const service of b2bFormServices) {
    const mapping = mappingByService.get(serviceKey(service));
    const fallbackLeader = await ownerForRoute(tx, company.workspace_id, "marketing_b2b", adminFallback);
    const fallbackDepartment = await departmentForRoute(tx, company.workspace_id, "marketing_b2b");
    const leaderId = mapping?.leader_id ?? fallbackLeader?.id ?? null;
    const departmentId = mapping?.department_id ?? fallbackDepartment?.id ?? null;
    const departmentName = mapping?.department?.name ?? fallbackDepartment?.name ?? "Marketing B2B";
    const needsMapping = !mapping?.leader_id;
    if (needsMapping) missingMappings.push(service);

    await tx.onboardingServiceAssignment.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        service,
        leader_id: leaderId,
        department_id: departmentId,
        department_name: departmentName,
        status: needsMapping ? "needs_mapping" : "assigned",
        notes: needsMapping ? "Needs service leader mapping. Fallback owner was assigned for continuity." : null,
      },
    });
    b2bAssignments.push({ service, leaderId, departmentId, departmentName, needsMapping });
  }

  if (b2bFormServices.length > 0) {
    const fallbackLeader = await ownerForRoute(tx, company.workspace_id, "marketing_b2b", adminFallback);
    const formOwnerId = b2bAssignments.find((assignment) => assignment.leaderId)?.leaderId ?? fallbackLeader?.id ?? null;
    const b2bProjectId = await resolveMarketingB2BOnboardingProjectId(tx, {
      workspaceId: company.workspace_id,
      companyId: company.id,
      companyName: company.name,
      ownerId: input.actorId,
    });
    const b2bTask = await createTask({
      project_id: b2bProjectId,
      route: "marketing_b2b",
      title: "Marketing B2B onboarding form",
      description: `Marketing B2B queue action: complete the client onboarding form for ${b2bFormServices.join(", ")}. Fields are optional and autosaved. Click Finalize onboarding B2B to update the central onboarding progress.`,
      status: "todo",
      priority: "high",
      assignee_id: formOwnerId,
      position,
    });
    const b2bItem = await tx.onboardingChecklistItem.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: b2bTask.id,
        department: "Marketing B2B",
        title: "Marketing B2B onboarding form completed",
        owner_id: formOwnerId,
        notes: b2bAssignments.some((assignment) => assignment.needsMapping)
          ? "One or more B2B services are using fallback owners and need service leader mapping."
          : null,
        sort_order: position,
      },
    });
    await tx.marketingB2BOnboardingForm.create({
      data: {
        workspace_id: company.workspace_id,
        onboarding_id: onboarding.id,
        checklist_item_id: b2bItem.id,
        task_id: b2bTask.id,
        company_id: company.id,
        project_id: b2bProjectId,
        values: {},
      },
    });
    notificationTargets.push({
      userId: formOwnerId,
      taskId: b2bTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Complete Marketing B2B onboarding form for ${company.name}`,
      companyId: company.id,
    });
    const b2bMeetingTask = await createTask({
      project_id: b2bProjectId,
      route: "marketing_b2b",
      title: "Onboarding: schedule Marketing B2B kickoff meeting",
      description:
        "Marketing B2B queue action: schedule the onboarding kickoff meeting with the client and link the calendar event back to this onboarding workflow.",
      status: "todo",
      priority: "medium",
      assignee_id: formOwnerId,
      position: position + 1,
    });
    const b2bMeetingItem = await tx.onboardingChecklistItem.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: b2bMeetingTask.id,
        department: "Marketing B2B",
        title: "Marketing B2B kickoff meeting scheduled",
        owner_id: formOwnerId,
        sort_order: position + 1,
      },
    });
    await tx.onboardingMeeting.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        service: "Marketing B2B kickoff",
        checklist_item_id: b2bMeetingItem.id,
        leader_id: formOwnerId,
      },
    });
    notificationTargets.push({
      userId: formOwnerId,
      taskId: b2bMeetingTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Schedule Marketing B2B kickoff meeting for ${company.name}`,
      companyId: company.id,
    });
    position += 20;
  }

  const b2cFormServices = responsibleIsB2C
    ? contractedServices
    : contractedServices.filter((service) => isMarketingB2CFormService(service) && !isMarketingB2BFormService(service));
  const b2cFormServiceKeys = new Set(b2cFormServices.map(serviceKey));
  const b2cAssignments: Array<{
    service: string;
    leaderId: string | null;
    departmentId: string | null;
    departmentName: string | null;
    needsMapping: boolean;
  }> = [];

  for (const service of b2cFormServices) {
    const mapping = mappingByService.get(serviceKey(service));
    const fallbackLeader = await ownerForRoute(tx, company.workspace_id, "marketing_b2c", adminFallback);
    const fallbackDepartment = await departmentForRoute(tx, company.workspace_id, "marketing_b2c");
    const leaderId = mapping?.leader_id ?? fallbackLeader?.id ?? null;
    const departmentId = mapping?.department_id ?? fallbackDepartment?.id ?? null;
    const departmentName = mapping?.department?.name ?? fallbackDepartment?.name ?? "Marketing B2C";
    const needsMapping = !mapping?.leader_id;
    if (needsMapping) missingMappings.push(service);

    await tx.onboardingServiceAssignment.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        service,
        leader_id: leaderId,
        department_id: departmentId,
        department_name: departmentName,
        status: needsMapping ? "needs_mapping" : "assigned",
        notes: needsMapping ? "Needs service leader mapping. Fallback owner was assigned for continuity." : null,
      },
    });
    b2cAssignments.push({ service, leaderId, departmentId, departmentName, needsMapping });
  }

  if (b2cFormServices.length > 0) {
    const fallbackLeader = await ownerForRoute(tx, company.workspace_id, "marketing_b2c", adminFallback);
    const formOwnerId = b2cAssignments.find((assignment) => assignment.leaderId)?.leaderId ?? fallbackLeader?.id ?? null;
    const b2cProjectId = await resolveMarketingB2COnboardingProjectId(tx, {
      workspaceId: company.workspace_id,
      companyId: company.id,
      companyName: company.name,
      ownerId: input.actorId,
    });
    const b2cTask = await createTask({
      project_id: b2cProjectId,
      route: "marketing_b2c",
      title: "Marketing B2C onboarding form",
      description: `Marketing B2C queue action: complete the client onboarding form for ${b2cFormServices.join(", ")}. Fields are optional and autosaved. Click Finalize onboarding B2C to update the central onboarding progress.`,
      status: "todo",
      priority: "high",
      assignee_id: formOwnerId,
      position,
    });
    const b2cItem = await tx.onboardingChecklistItem.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: b2cTask.id,
        department: "Marketing B2C",
        title: "Marketing B2C onboarding form completed",
        owner_id: formOwnerId,
        notes: b2cAssignments.some((assignment) => assignment.needsMapping)
          ? "One or more B2C services are using fallback owners and need service leader mapping."
          : null,
        sort_order: position,
      },
    });
    await tx.marketingB2COnboardingForm.create({
      data: {
        workspace_id: company.workspace_id,
        onboarding_id: onboarding.id,
        checklist_item_id: b2cItem.id,
        task_id: b2cTask.id,
        company_id: company.id,
        project_id: b2cProjectId,
        values: {},
      },
    });
    notificationTargets.push({
      userId: formOwnerId,
      taskId: b2cTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Complete Marketing B2C onboarding form for ${company.name}`,
      companyId: company.id,
    });
    const b2cMeetingTask = await createTask({
      project_id: b2cProjectId,
      route: "marketing_b2c",
      title: "Onboarding: schedule Marketing B2C kickoff meeting",
      description:
        "Marketing B2C queue action: schedule the onboarding kickoff meeting with the client and link the calendar event back to this onboarding workflow.",
      status: "todo",
      priority: "medium",
      assignee_id: formOwnerId,
      position: position + 1,
    });
    const b2cMeetingItem = await tx.onboardingChecklistItem.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: b2cMeetingTask.id,
        department: "Marketing B2C",
        title: "Marketing B2C kickoff meeting scheduled",
        owner_id: formOwnerId,
        sort_order: position + 1,
      },
    });
    await tx.onboardingMeeting.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        service: "Marketing B2C kickoff",
        checklist_item_id: b2cMeetingItem.id,
        leader_id: formOwnerId,
      },
    });
    notificationTargets.push({
      userId: formOwnerId,
      taskId: b2cMeetingTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Schedule Marketing B2C kickoff meeting for ${company.name}`,
      companyId: company.id,
    });
    position += 20;
  }

  for (const service of contractedServices) {
    if (b2bFormServiceKeys.has(serviceKey(service)) || b2cFormServiceKeys.has(serviceKey(service))) continue;
    const route = routeForService(service);
    const assignmentRoute = route ?? "commercial";
    const mapping = mappingByService.get(serviceKey(service));
    const fallbackLeader = await ownerForRoute(tx, company.workspace_id, assignmentRoute, adminFallback);
    const fallbackDepartment = await departmentForRoute(tx, company.workspace_id, assignmentRoute);
    const leaderId = mapping?.leader_id ?? fallbackLeader?.id ?? null;
    const departmentId = mapping?.department_id ?? fallbackDepartment?.id ?? null;
    const departmentName = mapping?.department?.name ?? fallbackDepartment?.name ?? null;
    const needsMapping = !mapping?.leader_id;
    if (needsMapping) missingMappings.push(service);

    const serviceProjectId = await queueProjectId(route);
    const serviceTask = await createTask({
      project_id: serviceProjectId,
      route: assignmentRoute,
      title: `Onboarding: schedule ${service} onboarding meeting`,
      description: `Service queue action: schedule the ${service} onboarding meeting and save the date/link in the onboarding workflow. When this task is marked done, the onboarding checklist and progress update automatically.`,
      status: "todo",
      priority: "medium",
      assignee_id: leaderId,
      position,
    });
    const item = await tx.onboardingChecklistItem.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        task_id: serviceTask.id,
        department: "Service Onboarding",
        title: `${service} onboarding meeting scheduled`,
        owner_id: leaderId,
        notes: needsMapping ? "Service leader mapping missing; fallback owner assigned." : null,
        sort_order: position,
      },
    });
    await tx.onboardingServiceAssignment.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        service,
        leader_id: leaderId,
        department_id: departmentId,
        department_name: departmentName,
        status: needsMapping ? "needs_mapping" : "assigned",
        notes: needsMapping ? "Needs service leader mapping. Fallback owner was assigned for continuity." : null,
      },
    });
    await tx.onboardingMeeting.create({
      data: {
        onboarding_id: onboarding.id,
        workspace_id: company.workspace_id,
        service,
        checklist_item_id: item.id,
        leader_id: leaderId,
      },
    });
    notificationTargets.push({
      userId: leaderId,
      taskId: serviceTask.id,
      workspaceId: company.workspace_id,
      onboardingId: onboarding.id,
      actorId: input.actorId,
      label: `Schedule ${service} onboarding meeting for ${company.name}`,
      companyId: company.id,
    });
    position += 10;
  }

  const refreshed = await recomputeOnboardingProgress(tx, onboarding.id);
  return { onboarding: refreshed, notificationTargets, createdTasks, missingMappings, reused: false };
}

export async function createClientOnboardingFromWizard(
  input: ClientOnboardingWizardInput,
): Promise<ClientOnboardingWizardResult> {
  const result = await prisma.$transaction(async (tx) => {
    const company = input.companyId
      ? await tx.company.update({
          where: { id: input.companyId },
          data: {
            name: input.name.trim(),
            website: cleanNullable(input.website),
            industry: cleanNullable(input.industry),
            service_type: cleanNullable(input.serviceType),
            plan_name: cleanNullable(input.planName),
            billing_cycle: cleanNullable(input.billingCycle),
            included_services: input.includedServices,
            notes: cleanNullable(input.notes),
            description: cleanNullable(input.notes),
            contract_value: input.contractValue ?? undefined,
            owner_id: input.ownerId ?? input.actorId,
          },
          select: {
            id: true,
            workspace_id: true,
            name: true,
            owner_id: true,
            included_services: true,
            service_type: true,
            plan_name: true,
          },
        })
      : await tx.company.create({
          data: {
            workspace_id: input.workspaceId,
            name: input.name.trim(),
            website: cleanNullable(input.website),
            industry: cleanNullable(input.industry),
            service_type: cleanNullable(input.serviceType),
            plan_name: cleanNullable(input.planName),
            billing_cycle: cleanNullable(input.billingCycle),
            included_services: input.includedServices,
            notes: cleanNullable(input.notes),
            description: cleanNullable(input.notes),
            contract_value: input.contractValue ?? null,
            owner_id: input.ownerId ?? input.actorId,
          },
          select: {
            id: true,
            workspace_id: true,
            name: true,
            owner_id: true,
            included_services: true,
            service_type: true,
            plan_name: true,
          },
        });

    if (company.workspace_id !== input.workspaceId) {
      throw new Error("Selected client does not belong to this workspace.");
    }

    if (input.contactName?.trim()) {
      await tx.companyContact.create({
        data: {
          workspace_id: input.workspaceId,
          company_id: company.id,
          name: input.contactName.trim(),
          email: cleanNullable(input.contactEmail),
          phone: cleanNullable(input.contactPhone),
          role: cleanNullable(input.contactRole),
        },
      });
    }

    const onboardingResult = await createOnboardingRecords(tx, {
      company,
      actorId: input.actorId,
      services: input.includedServices,
      closingDate: input.closingDate ?? null,
      expectedStartDate: input.expectedStartDate ?? null,
      initialNotes: input.initialNotes ?? input.notes ?? null,
      responsibleSalespersonId: input.responsibleSalespersonId ?? input.ownerId ?? input.actorId,
      responsibleDepartmentId: input.responsibleDepartmentId ?? null,
      responsibleDepartmentName: input.responsibleDepartmentName ?? null,
    });

    return { company, ...onboardingResult };
  });

  const assignedNotificationCount = await sendOnboardingAssignmentNotifications(result.notificationTargets);
  const adminNotificationCount = await sendOnboardingAdminSummaryNotifications({
    workspaceId: result.company.workspace_id,
    actorId: input.actorId,
    onboardingId: result.onboarding.id,
    companyId: result.company.id,
    companyName: result.company.name,
    createdTaskCount: result.createdTasks.length,
    missingMappings: result.missingMappings,
  });

  if (!result.reused) {
    await recordActivity({
      workspace_id: result.company.workspace_id,
      actor_id: input.actorId,
      type: "client_onboarding_started",
      entity_type: "client_onboarding",
      entity_id: result.onboarding.id,
      project_id: result.onboarding.project_id,
      company_id: result.company.id,
      metadata: {
        source: "client_wizard",
        status: result.onboarding.status,
        progress: result.onboarding.progress,
        services: result.onboarding.contracted_services,
        created_tasks: result.createdTasks.length,
        missing_mappings: result.missingMappings,
      },
    });
  }

  return {
    company_id: result.company.id,
    onboarding_id: result.onboarding.id,
    redirect_url: `/clients/${result.company.id}`,
    created_tasks: result.createdTasks,
    notifications: assignedNotificationCount + adminNotificationCount,
    missing_mappings: result.missingMappings,
  };
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
  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        name: true,
        workspace_id: true,
        space_id: true,
        company_id: true,
        owner_id: true,
        closing_date: true,
        onboarding_start_date: true,
        responsible_salesperson_id: true,
        initial_notes: true,
        space: { select: { id: true, name: true } },
        company: {
          select: {
            id: true,
            workspace_id: true,
            name: true,
            owner_id: true,
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

    return createOnboardingRecords(tx, {
      company: project.company,
      sourceProject: project,
      actorId: input.actorId,
      services: input.services,
      closingDate: input.closingDate,
      expectedStartDate: input.expectedStartDate,
      initialNotes: input.initialNotes,
      responsibleSalespersonId: input.responsibleSalespersonId,
    });
  });

  await sendOnboardingAssignmentNotifications(result.notificationTargets);
  if (!result.reused) {
    await recordActivity({
      workspace_id: result.onboarding.workspace_id,
      actor_id: input.actorId,
      type: "client_onboarding_started",
      entity_type: "client_onboarding",
      entity_id: result.onboarding.id,
      project_id: result.onboarding.project_id,
      company_id: result.onboarding.company_id,
      metadata: {
        source: "project_onboarding",
        status: result.onboarding.status,
        progress: result.onboarding.progress,
        services: result.onboarding.contracted_services,
        created_tasks: result.createdTasks.length,
        missing_mappings: result.missingMappings,
      },
    });
  }
  return result.onboarding;
}

export function onboardingSelect() {
  return {
    ...ONBOARDING_SAFE_SCALAR_SELECT,
    company: { select: { id: true, name: true } },
    project: { select: { id: true, name: true } },
    salesperson: { select: { id: true, name: true, email: true } },
    checklist_items: {
      orderBy: [{ sort_order: "asc" as const }, { created_at: "asc" as const }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        completer: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, title: true, status: true, project_id: true } },
        marketing_b2b_form: {
          select: {
            id: true,
            status: true,
            completed_at: true,
            updated_at: true,
            values: true,
            task_id: true,
            checklist_item_id: true,
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                project_id: true,
                assignee: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        marketing_b2c_form: {
          select: {
            id: true,
            status: true,
            completed_at: true,
            updated_at: true,
            values: true,
            task_id: true,
            checklist_item_id: true,
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                project_id: true,
                assignee: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
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
    marketing_b2b_forms: {
      orderBy: [{ created_at: "asc" as const }],
      select: {
        id: true,
        status: true,
        completed_at: true,
        updated_at: true,
        values: true,
        task_id: true,
        checklist_item_id: true,
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            project_id: true,
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    },
    marketing_b2c_forms: {
      orderBy: [{ created_at: "asc" as const }],
      select: {
        id: true,
        status: true,
        completed_at: true,
        updated_at: true,
        values: true,
        task_id: true,
        checklist_item_id: true,
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            project_id: true,
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    },
  };
}

export async function recomputeOnboardingProgress(db: Db, onboardingId: string) {
  const onboarding = await db.clientOnboarding.findUnique({
    where: { id: onboardingId },
    select: {
      ...ONBOARDING_SAFE_SCALAR_SELECT,
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
    select: { id: true },
  });

  return db.clientOnboarding.findUniqueOrThrow({
    where: { id: onboardingId },
    select: onboardingSelect(),
  });
}

export async function syncOnboardingChecklistFromTaskStatus(
  db: Db,
  input: { taskId: string; status: "todo" | "in_progress" | "done"; actorId: string },
) {
  const item = await db.onboardingChecklistItem.findFirst({
    where: { task_id: input.taskId },
    select: {
      id: true,
      onboarding_id: true,
      workspace_id: true,
      department: true,
      title: true,
      status: true,
    },
  });
  if (!item) return { linked: false as const };

  if (input.status === "done") {
    const blocker = await getOnboardingCompletionBlocker(db, item.onboarding_id, item);
    if (blocker) return { linked: true as const, blocked: true as const, reason: blocker };
    await db.onboardingChecklistItem.update({
      where: { id: item.id },
      data: {
        status: "complete",
        completed_at: new Date(),
        completed_by: input.actorId,
      },
    });
  } else if (item.status === "complete") {
    await db.onboardingChecklistItem.update({
      where: { id: item.id },
      data: {
        status: input.status === "in_progress" ? "in_progress" : "pending",
        completed_at: null,
        completed_by: null,
      },
    });
  } else if (item.status !== input.status && (input.status === "todo" || input.status === "in_progress")) {
    await db.onboardingChecklistItem.update({
      where: { id: item.id },
      data: { status: input.status === "in_progress" ? "in_progress" : "pending" },
    });
  }

  const onboarding = await recomputeOnboardingProgress(db, item.onboarding_id);
  await recordActivity({
    workspace_id: item.workspace_id,
    actor_id: input.actorId,
    type: "client_onboarding_item_updated",
    entity_type: "client_onboarding",
    entity_id: item.onboarding_id,
    project_id: onboarding.project_id,
    task_id: input.taskId,
    company_id: onboarding.company_id,
    metadata: {
      source: "task_status_sync",
      item_id: item.id,
      item_title: item.title,
      task_status: input.status,
      item_status: input.status === "done" ? "complete" : input.status === "in_progress" ? "in_progress" : "pending",
      progress: onboarding.progress,
    },
  });

  return { linked: true as const, blocked: false as const, onboarding };
}

export async function loadOnboardingAccess(auth: AuthUser, onboardingId: string) {
  const onboarding = await prisma.clientOnboarding.findUnique({
    where: { id: onboardingId },
    select: {
      ...ONBOARDING_SAFE_SCALAR_SELECT,
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
