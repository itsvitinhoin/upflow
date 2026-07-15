import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { loadOnboardingAccess, recomputeOnboardingProgress } from "@/lib/onboarding";
import { canContributeToProject, canReadProject } from "@/lib/project-access";
import { withErrorReporting } from "@/lib/with-error-reporting";

type JsonFormValue =
  | string
  | number
  | boolean
  | null
  | JsonFormValue[]
  | { [key: string]: JsonFormValue };

const JsonFormValueSchema: z.ZodType<JsonFormValue> = z.lazy(() =>
  z.union([
    z.string().max(10_000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonFormValueSchema),
    z.record(JsonFormValueSchema),
  ]),
);

const AddressSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  type: z.string().trim().max(80).optional(),
  locationName: z.string().trim().max(180).optional(),
  fullAddress: z.string().trim().max(2_000).optional(),
  zipCode: z.string().trim().max(40).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  mapsUrl: z.string().trim().max(2_000).optional(),
  localContactName: z.string().trim().max(180).optional(),
  localContactPhone: z.string().trim().max(80).optional(),
  departmentUsage: z.array(z.string().trim().max(80)).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().max(4_000).optional(),
});

const PatchSchema = z.object({
  field: z.string().trim().min(1).max(120).optional(),
  value: JsonFormValueSchema.optional(),
  values: z.record(JsonFormValueSchema).optional(),
  addresses: z.array(AddressSchema).optional(),
  finalize: z.boolean().optional(),
});

const addressSelect = {
  id: true,
  type: true,
  location_name: true,
  full_address: true,
  zip_code: true,
  city: true,
  state: true,
  country: true,
  maps_url: true,
  local_contact_name: true,
  local_contact_phone: true,
  department_usage: true,
  is_primary: true,
  notes: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.ClientAddressSelect;

const formInclude = {
  company: {
    select: {
      id: true,
      name: true,
      website: true,
      industry: true,
    },
  },
  onboarding: {
    select: {
      id: true,
      workspace_id: true,
      company_id: true,
      status: true,
      progress: true,
      contracted_services: true,
      service_assignments: {
        orderBy: [{ service: "asc" as const }],
        select: {
          id: true,
          service: true,
          leader_id: true,
          department_id: true,
          department_name: true,
          status: true,
          notes: true,
          leader: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true } },
        },
      },
    },
  },
  checklist_item: {
    select: {
      id: true,
      onboarding_id: true,
      department: true,
      title: true,
      status: true,
      owner_id: true,
      completed_at: true,
    },
  },
  task: {
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true, workspace_id: true, owner_id: true } },
    },
  },
  completer: { select: { id: true, name: true, email: true } },
} satisfies Prisma.MarketingB2BOnboardingFormInclude;

function isMissingClientAddressTableError(err: unknown) {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: unknown }).code
      : null;
  const message = err instanceof Error ? err.message : "";
  return code === "P2021" && message.includes("ClientAddress");
}

function normalizeJsonValue(raw: unknown): JsonFormValue {
  if (raw === null || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeJsonValue(item));
  }
  if (raw && typeof raw === "object") {
    const result: Record<string, JsonFormValue> = {};
    for (const [key, value] of Object.entries(raw)) {
      result[key] = normalizeJsonValue(value);
    }
    return result;
  }
  return "";
}

function valuesObject(value: Prisma.JsonValue | null | undefined): Record<string, JsonFormValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, JsonFormValue> = {};
  for (const [key, raw] of Object.entries(value)) {
    result[key] = normalizeJsonValue(raw);
  }
  return result;
}

function cleanJsonValue(value: JsonFormValue | undefined): Prisma.InputJsonValue {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.slice(0, 10_000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((item) => cleanJsonValue(item)) as Prisma.InputJsonArray;
  }

  const result: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, raw] of Object.entries(value)) {
    result[key.slice(0, 120)] = cleanJsonValue(raw);
  }
  return result as Prisma.InputJsonObject;
}

function cleanText(value: string | undefined | null, max = 2_000) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function cleanAddressPayload(addresses: z.infer<typeof AddressSchema>[]) {
  const meaningful = addresses
    .map((address) => ({
      id: cleanText(address.id, 120),
      type: cleanText(address.type, 80),
      locationName: cleanText(address.locationName, 180),
      fullAddress: cleanText(address.fullAddress, 2_000),
      zipCode: cleanText(address.zipCode, 40),
      city: cleanText(address.city, 120),
      state: cleanText(address.state, 120),
      country: cleanText(address.country, 120),
      mapsUrl: cleanText(address.mapsUrl, 2_000),
      localContactName: cleanText(address.localContactName, 180),
      localContactPhone: cleanText(address.localContactPhone, 80),
      departmentUsage: (address.departmentUsage ?? []).filter(Boolean).slice(0, 12),
      isPrimary: Boolean(address.isPrimary),
      notes: cleanText(address.notes, 4_000),
    }))
    .filter((address) => Boolean(address.fullAddress));

  const primaryIndex = meaningful.findIndex((address) => address.isPrimary);
  return meaningful.map((address, index) => ({
    ...address,
    isPrimary: primaryIndex >= 0 ? index === primaryIndex : index === 0,
  }));
}

async function syncClientAddresses(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  companyId: string,
  addresses: z.infer<typeof AddressSchema>[],
) {
  const cleaned = cleanAddressPayload(addresses);
  const existing = await tx.clientAddress.findMany({
    where: { workspace_id: workspaceId, company_id: companyId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((address) => address.id));
  const submittedIds = cleaned.flatMap((address) => (address.id && existingIds.has(address.id) ? [address.id] : []));

  await tx.clientAddress.deleteMany({
    where: {
      workspace_id: workspaceId,
      company_id: companyId,
      ...(submittedIds.length ? { id: { notIn: submittedIds } } : {}),
    },
  });

  for (const address of cleaned) {
    const data = {
      type: address.type,
      location_name: address.locationName,
      full_address: address.fullAddress ?? "",
      zip_code: address.zipCode,
      city: address.city,
      state: address.state,
      country: address.country,
      maps_url: address.mapsUrl,
      local_contact_name: address.localContactName,
      local_contact_phone: address.localContactPhone,
      department_usage: address.departmentUsage as Prisma.InputJsonValue,
      is_primary: address.isPrimary,
      notes: address.notes,
    };

    if (address.id && existingIds.has(address.id)) {
      await tx.clientAddress.update({
        where: { id: address.id },
        data,
      });
    } else {
      await tx.clientAddress.create({
        data: {
          workspace_id: workspaceId,
          company_id: companyId,
          ...data,
        },
      });
    }
  }
}

async function canUseClientAddresses() {
  try {
    await prisma.clientAddress.findFirst({ select: { id: true } });
    return true;
  } catch (err) {
    if (isMissingClientAddressTableError(err)) return false;
    throw err;
  }
}

function mapAddress(address: Prisma.ClientAddressGetPayload<{ select: typeof addressSelect }>) {
  return {
    id: address.id,
    type: address.type ?? "",
    locationName: address.location_name ?? "",
    fullAddress: address.full_address ?? "",
    zipCode: address.zip_code ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    country: address.country ?? "",
    mapsUrl: address.maps_url ?? "",
    localContactName: address.local_contact_name ?? "",
    localContactPhone: address.local_contact_phone ?? "",
    departmentUsage: Array.isArray(address.department_usage)
      ? address.department_usage.filter((item): item is string => typeof item === "string")
      : [],
    isPrimary: address.is_primary,
    notes: address.notes ?? "",
  };
}

async function loadForm(taskId: string) {
  return prisma.marketingB2BOnboardingForm.findUnique({
    where: { task_id: taskId },
    include: formInclude,
  });
}

async function loadCompanyAddresses(companyId: string) {
  try {
    return await prisma.clientAddress.findMany({
      where: { company_id: companyId },
      orderBy: [{ is_primary: "desc" as const }, { created_at: "asc" as const }],
      select: addressSelect,
    });
  } catch (err) {
    if (isMissingClientAddressTableError(err)) return [];
    throw err;
  }
}

function isBackfillableMarketingB2BFormTask(item: {
  department: string;
  title: string;
  task: { title: string; description: string | null } | null;
}) {
  const text = [item.department, item.title, item.task?.title, item.task?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes("marketing b2b") && text.includes("form");
}

function isUniqueConstraintError(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

function isBackfillableMarketingB2BTaskText(input: {
  department?: string | null;
  checklistTitle?: string | null;
  taskTitle?: string | null;
  taskDescription?: string | null;
  projectName?: string | null;
}) {
  const text = [input.department, input.checklistTitle, input.taskTitle, input.taskDescription, input.projectName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasFormSignal = text.includes("form") || text.includes("onboarding marketing b2b") || text.includes("marketing b2b onboarding");
  const hasSchedulingSignal = text.includes("meeting") || text.includes("reuni") || text.includes("schedule") || text.includes("kickoff") || text.includes("agenda");
  return text.includes("marketing b2b") && hasFormSignal && !hasSchedulingSignal;
}

async function loadExistingB2BFormForContext(input: {
  taskId?: string | null;
  checklistItemId?: string | null;
  onboardingId?: string | null;
}) {
  if (input.taskId) {
    const taskForm = await prisma.marketingB2BOnboardingForm.findUnique({
      where: { task_id: input.taskId },
      include: formInclude,
    });
    if (taskForm) return taskForm;
  }
  if (input.checklistItemId) {
    const checklistForm = await prisma.marketingB2BOnboardingForm.findUnique({
      where: { checklist_item_id: input.checklistItemId },
      include: formInclude,
    });
    if (checklistForm) return checklistForm;
  }
  if (!input.onboardingId) return null;

  return prisma.marketingB2BOnboardingForm.findFirst({
    where: { onboarding_id: input.onboardingId },
    orderBy: [{ updated_at: "desc" }, { created_at: "desc" }, { id: "asc" }],
    include: formInclude,
  });
}

async function bindExistingB2BFormToTask(
  form: NonNullable<Awaited<ReturnType<typeof loadForm>>>,
  input: {
    workspaceId: string;
    onboardingId: string;
    checklistItemId: string;
    taskId: string;
    companyId: string;
    projectId: string;
  },
) {
  if (
    form.workspace_id === input.workspaceId &&
    form.onboarding_id === input.onboardingId &&
    form.checklist_item_id === input.checklistItemId &&
    form.task_id === input.taskId &&
    form.company_id === input.companyId &&
    form.project_id === input.projectId
  ) {
    return form;
  }

  return prisma.marketingB2BOnboardingForm.update({
    where: { id: form.id },
    data: {
      workspace_id: input.workspaceId,
      onboarding_id: input.onboardingId,
      checklist_item_id: input.checklistItemId,
      task_id: input.taskId,
      company_id: input.companyId,
      project_id: input.projectId,
    },
    include: formInclude,
  });
}

async function ensureBackfilledB2BForm(taskId: string) {
  const item = await prisma.onboardingChecklistItem.findFirst({
    where: { task_id: taskId },
    include: {
      onboarding: {
        select: {
          id: true,
          workspace_id: true,
          company_id: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          description: true,
          project_id: true,
        },
      },
    },
  });

  if (item?.task_id && item.task) {
    const existing = await loadExistingB2BFormForContext({
      taskId,
      checklistItemId: item.id,
      onboardingId: item.onboarding_id,
    });
    if (existing) {
      try {
        return await bindExistingB2BFormToTask(existing, {
          workspaceId: item.workspace_id,
          onboardingId: item.onboarding_id,
          checklistItemId: item.id,
          taskId: item.task_id,
          companyId: item.onboarding.company_id,
          projectId: item.task.project_id,
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return (await loadForm(taskId)) ?? existing;
        }
        throw err;
      }
    }

    if (isBackfillableMarketingB2BFormTask(item)) {
      try {
        return await prisma.marketingB2BOnboardingForm.create({
          data: {
            workspace_id: item.workspace_id,
            onboarding_id: item.onboarding_id,
            checklist_item_id: item.id,
            task_id: item.task_id,
            company_id: item.onboarding.company_id,
            project_id: item.task.project_id,
            values: {},
          },
          include: formInclude,
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return loadExistingB2BFormForContext({
            taskId,
            checklistItemId: item.id,
            onboardingId: item.onboarding_id,
          });
        }
        throw err;
      }
    }
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      description: true,
      project_id: true,
      company_id: true,
      assignee_id: true,
      project: {
        select: {
          id: true,
          name: true,
          workspace_id: true,
          owner_id: true,
          company_id: true,
        },
      },
    },
  });
  const companyId = task?.company_id ?? task?.project.company_id ?? null;
  if (!task || !companyId) return null;
  if (
    !isBackfillableMarketingB2BTaskText({
      taskTitle: task.title,
      taskDescription: task.description,
      projectName: task.project.name,
    })
  ) {
    return null;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existingOnboarding = await tx.clientOnboarding.findFirst({
        where: {
          workspace_id: task.project.workspace_id,
          company_id: companyId,
          status: { not: "onboarding_complete" },
        },
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        select: { id: true, workspace_id: true, company_id: true },
      });
      const onboarding = existingOnboarding ?? await tx.clientOnboarding.create({
        data: {
          workspace_id: task.project.workspace_id,
          company_id: companyId,
          status: "pending_finance_registration",
          progress: 0,
          responsible_salesperson_id: task.assignee_id ?? task.project.owner_id,
          contracted_services: ["Marketing B2B"] as Prisma.InputJsonValue,
          created_by: task.project.owner_id,
        },
        select: { id: true, workspace_id: true, company_id: true },
      });

      const checklistItem = await tx.onboardingChecklistItem.findFirst({
        where: {
          onboarding_id: onboarding.id,
          task_id: task.id,
        },
        select: { id: true },
      }) ?? await tx.onboardingChecklistItem.create({
        data: {
          onboarding_id: onboarding.id,
          workspace_id: task.project.workspace_id,
          task_id: task.id,
          department: "Marketing B2B",
          title: "Marketing B2B onboarding form completed",
          owner_id: task.assignee_id,
          sort_order: 70,
        },
        select: { id: true },
      });

      const existing = await tx.marketingB2BOnboardingForm.findFirst({
        where: { onboarding_id: onboarding.id },
        orderBy: [{ updated_at: "desc" }, { created_at: "desc" }, { id: "asc" }],
        select: { id: true },
      });
      if (existing) {
        return tx.marketingB2BOnboardingForm.update({
          where: { id: existing.id },
          data: {
            workspace_id: task.project.workspace_id,
            onboarding_id: onboarding.id,
            checklist_item_id: checklistItem.id,
            task_id: task.id,
            company_id: companyId,
            project_id: task.project_id,
          },
          include: formInclude,
        });
      }

      return tx.marketingB2BOnboardingForm.create({
        data: {
          workspace_id: task.project.workspace_id,
          onboarding_id: onboarding.id,
          checklist_item_id: checklistItem.id,
          task_id: task.id,
          company_id: companyId,
          project_id: task.project_id,
          values: {},
        },
        include: formInclude,
      });
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return loadForm(taskId);
    }
    throw err;
  }
}

function responseBody(
  form: NonNullable<Awaited<ReturnType<typeof loadForm>>>,
  canEdit: boolean,
  addresses: Prisma.ClientAddressGetPayload<{ select: typeof addressSelect }>[],
) {
  return {
    id: form.id,
    status: form.status,
    values: valuesObject(form.values),
    completed_at: form.completed_at,
    updated_at: form.updated_at,
    completed_by: form.completed_by,
    completer: form.completer,
    can_edit: canEdit,
    task: {
      id: form.task.id,
      title: form.task.title,
      status: form.task.status,
      assignee: form.task.assignee,
      project: form.task.project,
    },
    company: {
      ...form.company,
      addresses: addresses.map(mapAddress),
    },
    onboarding: form.onboarding,
    checklist_item: form.checklist_item,
  };
}

async function getAccess(taskId: string) {
  const _r = await requireAuth();
  if (!_r.ok) return { ok: false as const, response: _r.response };
  const auth = _r.auth;
  const form = (await loadForm(taskId)) ?? (await ensureBackfilledB2BForm(taskId));
  if (!form) {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  if (!(await canReadProject(auth, form.task.project)) && form.task.assignee_id !== auth.prismaUser.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const onboardingAccess = await loadOnboardingAccess(auth, form.onboarding_id);
  if (!onboardingAccess) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const canEdit = Boolean(
    (await canContributeToProject(auth, form.task.project)) ||
      onboardingAccess.admin ||
      form.task.assignee_id === auth.prismaUser.id ||
      form.checklist_item.owner_id === auth.prismaUser.id ||
      onboardingAccess.canUpdateChecklistItem(form.checklist_item),
  );

  return { ok: true as const, auth, form, canEdit };
}

async function GET_handler(
  _req: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const access = await getAccess(params.taskId);
  if (!access.ok) return access.response;
  const addresses = await loadCompanyAddresses(access.form.company_id);
  return NextResponse.json(responseBody(access.form, access.canEdit, addresses));
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { taskId: string } },
) {
  const access = await getAccess(params.taskId);
  if (!access.ok) return access.response;
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Marketing B2B form", issues: parsed.error.flatten() }, { status: 400 });
  }

  const currentValues = valuesObject(access.form.values);
  const nextValues: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of Object.entries(currentValues)) {
    nextValues[key] = cleanJsonValue(value);
  }

  if (parsed.data.field) {
    nextValues[parsed.data.field] = cleanJsonValue(parsed.data.value);
  }
  if (parsed.data.values) {
    for (const [key, value] of Object.entries(parsed.data.values)) {
      nextValues[key] = cleanJsonValue(value);
    }
  }
  const canSyncAddresses = parsed.data.addresses ? await canUseClientAddresses() : false;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.marketingB2BOnboardingForm.update({
      where: { id: access.form.id },
      data: {
        values: nextValues as Prisma.InputJsonValue,
        ...(parsed.data.finalize
          ? {
              status: "complete",
              completed_at: new Date(),
              completed_by: access.auth.prismaUser.id,
            }
          : access.form.status !== "complete"
            ? { status: "in_progress" }
            : {}),
      },
    });

    if (parsed.data.addresses && canSyncAddresses) {
      await syncClientAddresses(tx, access.form.workspace_id, access.form.company_id, parsed.data.addresses);
    }

    if (parsed.data.finalize) {
      await tx.task.update({
        where: { id: access.form.task_id },
        data: { status: "done" },
      });
      await tx.onboardingChecklistItem.update({
        where: { id: access.form.checklist_item_id },
        data: {
          status: "complete",
          completed_at: new Date(),
          completed_by: access.auth.prismaUser.id,
        },
      });
      await recomputeOnboardingProgress(tx, access.form.onboarding_id);
    } else if (access.form.status !== "complete") {
      if (access.form.task.status === "todo") {
        await tx.task.update({
          where: { id: access.form.task_id },
          data: { status: "in_progress" },
        });
      }
      if (access.form.checklist_item.status === "pending") {
        await tx.onboardingChecklistItem.update({
          where: { id: access.form.checklist_item_id },
          data: { status: "in_progress" },
        });
      }
    }

    return tx.marketingB2BOnboardingForm.findUniqueOrThrow({
      where: { id: access.form.id },
      include: formInclude,
    });
  });
  const addresses = await loadCompanyAddresses(updated.company_id);

  if (parsed.data.finalize) {
    await recordActivity({
      workspace_id: access.form.workspace_id,
      actor_id: access.auth.prismaUser.id,
      type: "marketing_b2b_onboarding_finalized",
      entity_type: "client_onboarding",
      entity_id: access.form.onboarding_id,
      project_id: access.form.project_id,
      task_id: access.form.task_id,
      company_id: access.form.company_id,
      metadata: {
        form_id: access.form.id,
        task_title: access.form.task.title,
      },
    });
  }

  return NextResponse.json(responseBody(updated, access.canEdit, addresses));
}

export const GET = withErrorReporting("api:onboarding/marketing-b2b-form:GET", GET_handler);
export const PATCH = withErrorReporting("api:onboarding/marketing-b2b-form:PATCH", PATCH_handler);
