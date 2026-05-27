import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/log-error";
import type { TaskTemplateId } from "@/lib/task-templates";

export type DepartmentSpaceKey =
  | "comercial"
  | "marketing_b2b"
  | "marketing_b2c"
  | "creative_design"
  | "finance"
  | "production"
  | "general_admin";

export interface DepartmentSpacePreset {
  department_key: DepartmentSpaceKey;
  name: string;
  emoji: string;
  description: string;
  starter_lists: string[];
  default_task_template_id: TaskTemplateId;
  dashboard_focus_labels: {
    urgent: string;
    workload: string;
    time: string;
    meetings: string;
    activity: string;
    risk: string;
    empty: string;
  };
}

export const DEPARTMENT_SPACE_PRESETS: DepartmentSpacePreset[] = [
  {
    department_key: "comercial",
    name: "Comercial",
    emoji: "💼",
    description: "Sales pipeline, proposals, follow-ups, contracts, and commissions.",
    starter_lists: ["Leads", "Proposals", "Follow-ups", "Contracts"],
    default_task_template_id: "commercial",
    dashboard_focus_labels: {
      urgent: "Deals, follow-ups, and proposals needing action",
      workload: "Commercial workload by owner",
      time: "Tracked on sales and proposal work",
      meetings: "Sales meetings linked to this Space",
      activity: "Pipeline and contract activity",
      risk: "Deals or contracts with stale movement",
      empty: "Create a commercial list to start tracking leads, proposals, and follow-ups.",
    },
  },
  {
    department_key: "marketing_b2b",
    name: "Marketing B2B",
    emoji: "🎯",
    description: "B2B campaigns, outbound, landing pages, and reporting.",
    starter_lists: ["Campaigns", "LinkedIn & Outbound", "Landing Pages", "Reports"],
    default_task_template_id: "b2b_marketing",
    dashboard_focus_labels: {
      urgent: "B2B campaigns and reports needing action",
      workload: "B2B campaign workload by owner",
      time: "Tracked on B2B marketing work",
      meetings: "B2B planning and review meetings",
      activity: "Campaign and outbound activity",
      risk: "Campaigns with overdue work or no movement",
      empty: "Create a B2B marketing list to organize campaigns, outbound, and reports.",
    },
  },
  {
    department_key: "marketing_b2c",
    name: "Marketing B2C",
    emoji: "📣",
    description: "Consumer campaigns, content calendar, ads, and promotions.",
    starter_lists: ["Campaigns", "Content Calendar", "Ads", "Promotions"],
    default_task_template_id: "b2c_marketing",
    dashboard_focus_labels: {
      urgent: "B2C campaigns, ads, and promos needing action",
      workload: "B2C marketing workload by owner",
      time: "Tracked on B2C campaign work",
      meetings: "Consumer campaign meetings",
      activity: "Content, ads, and promo activity",
      risk: "Campaigns with overdue work or stalled publishing",
      empty: "Create a B2C marketing list to plan campaigns, content, ads, and promotions.",
    },
  },
  {
    department_key: "creative_design",
    name: "Creative & Design",
    emoji: "🎨",
    description: "Design queue, creative reviews, brand assets, and approvals.",
    starter_lists: ["Design Queue", "Creative Reviews", "Brand Assets", "Approvals"],
    default_task_template_id: "creative",
    dashboard_focus_labels: {
      urgent: "Design requests and approvals needing action",
      workload: "Creative workload by designer or owner",
      time: "Tracked on creative production",
      meetings: "Creative reviews linked to this Space",
      activity: "Design queue and approval activity",
      risk: "Creative work blocked, overdue, or waiting approval",
      empty: "Create a creative list to manage design requests, reviews, and approvals.",
    },
  },
  {
    department_key: "finance",
    name: "Finance",
    emoji: "💰",
    description: "Invoices, payments, commissions, expenses, and cashflow operations.",
    starter_lists: ["Invoices", "Payments", "Commissions", "Expenses"],
    default_task_template_id: "finance",
    dashboard_focus_labels: {
      urgent: "Invoices, payments, or commissions needing action",
      workload: "Finance workload by owner",
      time: "Tracked on finance operations",
      meetings: "Finance meetings linked to this Space",
      activity: "Invoice, payment, and expense activity",
      risk: "Finance work overdue, unpaid, or missing ownership",
      empty: "Create a finance list to track invoices, payments, commissions, and expenses.",
    },
  },
  {
    department_key: "production",
    name: "Production",
    emoji: "🎬",
    description: "Shoots, editing, publishing, deliverables, and production handoffs.",
    starter_lists: ["Shoots", "Editing", "Publishing", "Deliverables"],
    default_task_template_id: "production",
    dashboard_focus_labels: {
      urgent: "Shoots, edits, and deliverables needing action",
      workload: "Production workload by owner",
      time: "Tracked on production work",
      meetings: "Production planning and review meetings",
      activity: "Shoot, editing, and publishing activity",
      risk: "Production work overdue, blocked, or waiting delivery",
      empty: "Create a production list to manage shoots, editing, publishing, and deliverables.",
    },
  },
  {
    department_key: "general_admin",
    name: "General Admin",
    emoji: "⚙️",
    description: "Internal requests, access, documents, vendors, and admin operations.",
    starter_lists: ["Internal Requests", "Access & Accounts", "Documents", "Vendors"],
    default_task_template_id: "admin",
    dashboard_focus_labels: {
      urgent: "Internal requests and access work needing action",
      workload: "Admin workload by owner",
      time: "Tracked on admin operations",
      meetings: "Admin meetings linked to this Space",
      activity: "Requests, documents, and vendor activity",
      risk: "Admin work overdue, unowned, or stale",
      empty: "Create an admin list to handle internal requests, access, documents, and vendors.",
    },
  },
];

export function normalizeDepartmentSpaceName(input: string) {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}&]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDepartmentSpacePreset(name: string | null | undefined) {
  if (!name) return null;
  const normalized = normalizeDepartmentSpaceName(name);
  return (
    DEPARTMENT_SPACE_PRESETS.find(
      (preset) => normalizeDepartmentSpaceName(preset.name) === normalized,
    ) ?? null
  );
}

async function pickDepartmentOwnerId(workspaceId: string, fallbackOwnerId: string) {
  const owner =
    (await prisma.workspaceMember.findFirst({
      where: { workspace_id: workspaceId, role: "owner", status: "active" },
      select: { user_id: true },
      orderBy: { created_at: "asc" },
    })) ??
    (await prisma.workspaceMember.findFirst({
      where: { workspace_id: workspaceId, role: "admin", status: "active" },
      select: { user_id: true },
      orderBy: { created_at: "asc" },
    }));

  return owner?.user_id ?? fallbackOwnerId;
}

export async function ensureDepartmentSpaces(workspaceId: string, fallbackOwnerId: string) {
  try {
    const ownerId = await pickDepartmentOwnerId(workspaceId, fallbackOwnerId);
    const existingSpaces = await prisma.space.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true, name: true, position: true },
      orderBy: [{ position: "asc" }, { created_at: "asc" }],
    });
    const spacesByName = new Map(
      existingSpaces.map((space) => [normalizeDepartmentSpaceName(space.name), space]),
    );
    let nextPosition =
      existingSpaces.reduce((max, space) => Math.max(max, space.position), -1) + 1;

    for (const preset of DEPARTMENT_SPACE_PRESETS) {
      const normalizedPresetName = normalizeDepartmentSpaceName(preset.name);
      let space = spacesByName.get(normalizedPresetName);

      if (!space) {
        space = await prisma.space.create({
          data: {
            name: preset.name,
            icon: preset.emoji,
            workspace_id: workspaceId,
            owner_id: ownerId,
            position: nextPosition,
          },
          select: { id: true, name: true, position: true },
        });
        spacesByName.set(normalizedPresetName, space);
        nextPosition += 1;
      }
    }

    const departmentSpaceIds = DEPARTMENT_SPACE_PRESETS.map(
      (preset) => spacesByName.get(normalizeDepartmentSpaceName(preset.name))?.id,
    ).filter((id): id is string => Boolean(id));
    const existingProjects = await prisma.project.findMany({
      where: { workspace_id: workspaceId, space_id: { in: departmentSpaceIds } },
      select: { name: true, space_id: true },
    });
    const projectNamesBySpace = new Map<string, Set<string>>();
    for (const project of existingProjects) {
      if (!project.space_id) continue;
      const names = projectNamesBySpace.get(project.space_id) ?? new Set<string>();
      names.add(normalizeDepartmentSpaceName(project.name));
      projectNamesBySpace.set(project.space_id, names);
    }

    for (const preset of DEPARTMENT_SPACE_PRESETS) {
      const space = spacesByName.get(normalizeDepartmentSpaceName(preset.name));
      if (!space) continue;

      const existingProjectNames = projectNamesBySpace.get(space.id) ?? new Set<string>();
      const missingLists = preset.starter_lists.filter(
        (listName) => !existingProjectNames.has(normalizeDepartmentSpaceName(listName)),
      );

      if (missingLists.length > 0) {
        const listData = missingLists.map((name) => ({
          name,
          workspace_id: workspaceId,
          owner_id: ownerId,
          space_id: space.id,
        }));
        await prisma.project.createMany({
          data: listData,
          skipDuplicates: true,
        });
      }
    }
  } catch (err) {
    logError("department-spaces:ensure", err, { workspaceId });
  }
}
