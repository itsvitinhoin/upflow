import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { loadOnboardingAccess, recomputeOnboardingProgress } from "@/lib/onboarding";
import { canContributeToProject, canReadProject } from "@/lib/project-access";
import { withErrorReporting } from "@/lib/with-error-reporting";

const FieldValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const PatchSchema = z.object({
  field: z.string().trim().min(1).max(120).optional(),
  value: FieldValueSchema.optional(),
  values: z.record(FieldValueSchema).optional(),
  finalize: z.boolean().optional(),
});

function valuesObject(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) {
      result[key] = "";
    } else if (typeof raw === "string") {
      result[key] = raw;
    } else {
      result[key] = String(raw);
    }
  }
  return result;
}

function cleanFieldValue(value: z.infer<typeof FieldValueSchema> | undefined) {
  if (value === undefined || value === null) return "";
  return String(value).slice(0, 4_000);
}

const formInclude = {
  company: { select: { id: true, name: true, website: true, industry: true } },
  onboarding: {
    select: {
      id: true,
      workspace_id: true,
      company_id: true,
      status: true,
      progress: true,
      contracted_services: true,
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
} satisfies Prisma.MarketingB2COnboardingFormInclude;

async function loadForm(taskId: string) {
  return prisma.marketingB2COnboardingForm.findUnique({
    where: { task_id: taskId },
    include: formInclude,
  });
}

function isBackfillableMarketingB2CFormTask(item: {
  department: string;
  title: string;
  task: { title: string; description: string | null } | null;
}) {
  const text = [item.department, item.title, item.task?.title, item.task?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasFormSignal = text.includes("form") || text.includes("onboarding marketing b2c") || text.includes("marketing b2c onboarding");
  const hasSchedulingSignal = text.includes("meeting") || text.includes("reuni") || text.includes("schedule") || text.includes("kickoff") || text.includes("agenda");
  return text.includes("marketing b2c") && hasFormSignal && !hasSchedulingSignal;
}

function isBackfillableMarketingB2CTaskText(input: {
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
  const hasFormSignal = text.includes("form") || text.includes("onboarding marketing b2c") || text.includes("marketing b2c onboarding");
  const hasSchedulingSignal = text.includes("meeting") || text.includes("reuni") || text.includes("schedule") || text.includes("kickoff") || text.includes("agenda");
  return text.includes("marketing b2c") && hasFormSignal && !hasSchedulingSignal;
}

function isUniqueConstraintError(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

async function loadExistingB2CFormForContext(input: {
  taskId?: string | null;
  checklistItemId?: string | null;
  onboardingId?: string | null;
}) {
  if (input.taskId) {
    const taskForm = await prisma.marketingB2COnboardingForm.findUnique({
      where: { task_id: input.taskId },
      include: formInclude,
    });
    if (taskForm) return taskForm;
  }
  if (input.checklistItemId) {
    const checklistForm = await prisma.marketingB2COnboardingForm.findUnique({
      where: { checklist_item_id: input.checklistItemId },
      include: formInclude,
    });
    if (checklistForm) return checklistForm;
  }
  if (!input.onboardingId) return null;

  return prisma.marketingB2COnboardingForm.findFirst({
    where: { onboarding_id: input.onboardingId },
    orderBy: [{ updated_at: "desc" }, { created_at: "desc" }, { id: "asc" }],
    include: formInclude,
  });
}

async function bindExistingB2CFormToTask(
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

  return prisma.marketingB2COnboardingForm.update({
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

async function ensureBackfilledB2CForm(taskId: string) {
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

  if (item?.task_id && item.task && isBackfillableMarketingB2CFormTask(item)) {
    const existing = await loadExistingB2CFormForContext({
      taskId,
      checklistItemId: item.id,
      onboardingId: item.onboarding_id,
    });
    if (existing) {
      try {
        return await bindExistingB2CFormToTask(existing, {
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

    try {
      return await prisma.marketingB2COnboardingForm.create({
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
        return loadExistingB2CFormForContext({
          taskId,
          checklistItemId: item.id,
          onboardingId: item.onboarding_id,
        });
      }
      throw err;
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
    !isBackfillableMarketingB2CTaskText({
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
          contracted_services: ["Marketing B2C"] as Prisma.InputJsonValue,
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
          department: "Marketing B2C",
          title: "Marketing B2C onboarding form completed",
          owner_id: task.assignee_id,
          sort_order: 70,
        },
        select: { id: true },
      });

      const existing = await tx.marketingB2COnboardingForm.findFirst({
        where: { onboarding_id: onboarding.id },
        orderBy: [{ updated_at: "desc" }, { created_at: "desc" }, { id: "asc" }],
        select: { id: true },
      });
      if (existing) {
        return tx.marketingB2COnboardingForm.update({
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

      return tx.marketingB2COnboardingForm.create({
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
) {
  return {
    id: form.id,
    status: form.status,
    values: valuesObject(form.values),
    completed_at: form.completed_at,
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
    company: form.company,
    onboarding: form.onboarding,
    checklist_item: form.checklist_item,
  };
}

async function getAccess(taskId: string) {
  const _r = await requireAuth();
  if (!_r.ok) return { ok: false as const, response: _r.response };
  const auth = _r.auth;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, assignee_id: true, project: { select: { id: true, workspace_id: true, owner_id: true } } },
  });
  if (!task) return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!(await canReadProject(auth, task.project)) && task.assignee_id !== auth.prismaUser.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const form = (await loadForm(taskId)) ?? (await ensureBackfilledB2CForm(taskId));
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

  const canEdit = onboardingAccess.canWork && Boolean(
    (await canContributeToProject(auth, form.task.project)) ||
      onboardingAccess.admin ||
      form.task.assignee_id === auth.prismaUser.id ||
      form.checklist_item.owner_id === auth.prismaUser.id ||
      onboardingAccess.canUpdateChecklistItem(form.checklist_item),
  );

  return { ok: true as const, auth, form, canEdit };
}

type RouteContext = { params: Promise<{ taskId: string }> };

async function GET_handler(
  _req: NextRequest,
  { params }: RouteContext,
) {
  const { taskId } = await params;
  const access = await getAccess(taskId);
  if (!access.ok) return access.response;
  return NextResponse.json(responseBody(access.form, access.canEdit));
}

async function PATCH_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const { taskId } = await params;
  const access = await getAccess(taskId);
  if (!access.ok) return access.response;
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Marketing B2C form", issues: parsed.error.flatten() }, { status: 400 });
  }

  const currentValues = valuesObject(access.form.values);
  const nextValues = { ...currentValues };
  if (parsed.data.field) {
    nextValues[parsed.data.field] = cleanFieldValue(parsed.data.value);
  }
  if (parsed.data.values) {
    for (const [key, value] of Object.entries(parsed.data.values)) {
      nextValues[key] = cleanFieldValue(value);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.marketingB2COnboardingForm.update({
      where: { id: access.form.id },
      data: {
        values: nextValues as Prisma.InputJsonValue,
        ...(parsed.data.finalize
          ? {
              status: "complete",
              completed_at: new Date(),
              completed_by: access.auth.prismaUser.id,
            }
          : {}),
      },
    });

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
    } else {
      if (access.form.status === "draft") {
        await tx.marketingB2COnboardingForm.update({
          where: { id: access.form.id },
          data: { status: "in_progress" },
        });
      }
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

    return tx.marketingB2COnboardingForm.findUniqueOrThrow({
      where: { id: access.form.id },
      include: {
        company: { select: { id: true, name: true, website: true, industry: true } },
        onboarding: {
          select: {
            id: true,
            workspace_id: true,
            company_id: true,
            status: true,
            progress: true,
            contracted_services: true,
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
      },
    });
  });

  if (parsed.data.finalize) {
    await recordActivity({
      workspace_id: access.form.workspace_id,
      actor_id: access.auth.prismaUser.id,
      type: "marketing_b2c_onboarding_finalized",
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

  return NextResponse.json(responseBody(updated, access.canEdit));
}

export const GET = withErrorReporting("api:onboarding/marketing-b2c-form:GET", GET_handler);
export const PATCH = withErrorReporting("api:onboarding/marketing-b2c-form:PATCH", PATCH_handler);
