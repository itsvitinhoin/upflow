import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { loadOnboardingAccess, recomputeOnboardingProgress } from "@/lib/onboarding";
import { canReadProject } from "@/lib/project-access";
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

async function loadForm(taskId: string) {
  return prisma.marketingB2COnboardingForm.findUnique({
    where: { task_id: taskId },
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
  const form = await loadForm(taskId);
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
  return NextResponse.json(responseBody(access.form, access.canEdit));
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
