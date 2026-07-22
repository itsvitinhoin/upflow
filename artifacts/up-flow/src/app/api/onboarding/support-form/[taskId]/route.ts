import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import {
  isUpZeroConfigurationChecklistItem,
  loadOnboardingAccess,
  recomputeOnboardingProgress,
} from "@/lib/onboarding";
import { canContributeToProject, canReadProject } from "@/lib/project-access";
import { routeForOnboardingChecklistItem } from "@/lib/onboarding-routing";
import { withErrorReporting } from "@/lib/with-error-reporting";

const SupportGroupSchema = z.object({
  group_created: z.boolean().optional(),
  group_name: z.string().optional().nullable(),
  group_link: z.string().optional().nullable(),
  main_client_contact: z.string().optional().nullable(),
  commercial_responsible: z.string().optional().nullable(),
  account_responsible: z.string().optional().nullable(),
  internal_participants: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  client_participants: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  status: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const PatchSchema = z.object({
  support_group: SupportGroupSchema.optional(),
  complete: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ taskId: string }> };

function cleanText(value: string | null | undefined, max = 4_000) {
  const text = value?.trim();
  return text ? text.slice(0, max) : null;
}

function cleanList(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length ? items : null;
  }
  const text = value?.trim();
  if (!text) return null;
  const items = text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

function supportGroupUpdateData(supportGroup: z.infer<typeof SupportGroupSchema>) {
  const data: Record<string, string | string[] | boolean | Date | null> = {};
  if ("group_created" in supportGroup) data.group_created = Boolean(supportGroup.group_created);
  if ("group_name" in supportGroup) data.group_name = cleanText(supportGroup.group_name, 255);
  if ("group_link" in supportGroup) data.group_link = cleanText(supportGroup.group_link, 600);
  if ("main_client_contact" in supportGroup) data.main_client_contact = cleanText(supportGroup.main_client_contact, 255);
  if ("commercial_responsible" in supportGroup) data.commercial_responsible = cleanText(supportGroup.commercial_responsible, 255);
  if ("account_responsible" in supportGroup) data.account_responsible = cleanText(supportGroup.account_responsible, 255);
  if ("internal_participants" in supportGroup) data.internal_participants = cleanList(supportGroup.internal_participants);
  if ("client_participants" in supportGroup) data.client_participants = cleanList(supportGroup.client_participants);
  if ("status" in supportGroup) data.status = cleanText(supportGroup.status, 80) ?? "not_created";
  if ("notes" in supportGroup) data.notes = cleanText(supportGroup.notes, 4_000);
  if (data.group_created) {
    data.group_created_at = new Date();
    data.status = "created";
  }
  return data;
}

async function loadSupportTask(taskId: string) {
  return prisma.onboardingChecklistItem.findFirst({
    where: { task_id: taskId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      task: {
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true, workspace_id: true, owner_id: true } },
        },
      },
      onboarding: {
        include: {
          company: true,
          support_group: {
            include: {
              creator: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });
}

function responseBody(
  item: NonNullable<Awaited<ReturnType<typeof loadSupportTask>>>,
  canEdit: boolean,
) {
  return {
    can_edit: canEdit,
    task: item.task
      ? {
          id: item.task.id,
          title: item.task.title,
          status: item.task.status,
          assignee: item.task.assignee,
          project: item.task.project,
        }
      : null,
    checklist_item: {
      id: item.id,
      title: item.title,
      status: item.status,
    },
    company: {
      id: item.onboarding.company.id,
      name: item.onboarding.company.name,
      main_contact_email: item.onboarding.company.main_contact_email,
      phone: item.onboarding.company.phone,
      whatsapp: item.onboarding.company.whatsapp,
    },
    onboarding: {
      id: item.onboarding.id,
      status: item.onboarding.status,
      progress: item.onboarding.progress,
    },
    support_group: item.onboarding.support_group,
  };
}

async function getAccess(taskId: string) {
  const _r = await requireAuth();
  if (!_r.ok) return { ok: false as const, response: _r.response };
  const auth = _r.auth;

  const item = await loadSupportTask(taskId);
  if (!item || !item.task || isUpZeroConfigurationChecklistItem(item) || routeForOnboardingChecklistItem(item) !== "support") {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  if (!(await canReadProject(auth, item.task.project)) && item.task.assignee_id !== auth.prismaUser.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const onboardingAccess = await loadOnboardingAccess(auth, item.onboarding_id);
  if (!onboardingAccess) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const canEdit = Boolean(
    (await canContributeToProject(auth, item.task.project)) ||
      onboardingAccess.admin ||
      item.task.assignee_id === auth.prismaUser.id ||
      item.owner_id === auth.prismaUser.id ||
      onboardingAccess.canUpdateSupport ||
      onboardingAccess.canUpdateChecklistItem(item),
  );

  return { ok: true as const, auth, item, canEdit };
}

async function GET_handler(
  _req: NextRequest,
  { params }: RouteContext,
) {
  const { taskId } = await params;
  const access = await getAccess(taskId);
  if (!access.ok) return access.response;
  return NextResponse.json(responseBody(access.item, access.canEdit));
}

async function PATCH_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const { taskId } = await params;
  const access = await getAccess(taskId);
  if (!access.ok) return access.response;
  if (!access.canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const linkedTask = access.item.task;
  if (!linkedTask) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid support onboarding form", issues: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.support_group) {
      const data = supportGroupUpdateData(parsed.data.support_group);
      await tx.supportGroup.upsert({
        where: { onboarding_id: access.item.onboarding_id },
        update: data,
        create: {
          onboarding_id: access.item.onboarding_id,
          workspace_id: access.item.workspace_id,
          created_by: access.auth.prismaUser.id,
          ...data,
        },
      });
    }

    if (parsed.data.complete) {
      await tx.supportGroup.upsert({
        where: { onboarding_id: access.item.onboarding_id },
        update: {
          group_created: true,
          group_created_at: new Date(),
          status: "created",
        },
        create: {
          onboarding_id: access.item.onboarding_id,
          workspace_id: access.item.workspace_id,
          created_by: access.auth.prismaUser.id,
          group_created: true,
          group_created_at: new Date(),
          status: "created",
        },
      });
      await tx.task.update({
        where: { id: access.item.task_id ?? taskId },
        data: { status: "done" },
      });
      await tx.onboardingChecklistItem.update({
        where: { id: access.item.id },
        data: {
          status: "complete",
          completed_at: new Date(),
          completed_by: access.auth.prismaUser.id,
        },
      });
      await recomputeOnboardingProgress(tx, access.item.onboarding_id);
    } else {
      if (linkedTask.status === "todo") {
        await tx.task.update({
          where: { id: linkedTask.id },
          data: { status: "in_progress" },
        });
      }
      if (access.item.status === "pending") {
        await tx.onboardingChecklistItem.update({
          where: { id: access.item.id },
          data: { status: "in_progress" },
        });
      }
    }
  });

  await recordActivity({
    workspace_id: access.item.workspace_id,
    actor_id: access.auth.prismaUser.id,
    type: parsed.data.complete ? "client_support_group_completed" : "client_support_group_updated",
    entity_type: "client_onboarding",
    entity_id: access.item.onboarding_id,
    project_id: linkedTask.project_id,
    task_id: access.item.task_id,
    company_id: access.item.onboarding.company_id,
    metadata: {
      checklist_item_id: access.item.id,
      task_title: linkedTask.title,
    },
  });

  const updated = await loadSupportTask(taskId);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(responseBody(updated, access.canEdit));
}

export const GET = withErrorReporting("api:onboarding/support-form:GET", GET_handler);
export const PATCH = withErrorReporting("api:onboarding/support-form:PATCH", PATCH_handler);
