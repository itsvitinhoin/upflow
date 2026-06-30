import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import {
  financeRegistrationComplete,
  loadOnboardingAccess,
  onboardingInclude,
  recomputeOnboardingProgress,
  redactOnboardingContracts,
  resolveOnboardingTaskProjectId,
  sendOnboardingAssignmentNotifications,
  type OnboardingAssignmentNotificationTarget,
} from "@/lib/onboarding";
import { withErrorReporting } from "@/lib/with-error-reporting";

const PatchSchema = z.object({
  finance: z.object({
    legal_name: z.string().trim().nullable().optional(),
    cnpj: z.string().trim().nullable().optional(),
    billing_email: z.string().trim().email().nullable().optional(),
    main_contact_email: z.string().trim().email().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    whatsapp: z.string().trim().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    billing_notes: z.string().trim().nullable().optional(),
    contract_value: z.number().nullable().optional(),
    payment_terms: z.string().trim().nullable().optional(),
    contract_start_date: z.string().nullable().optional(),
  }).optional(),
  support_group: z.object({
    group_created: z.boolean().optional(),
    group_link: z.string().trim().nullable().optional(),
    internal_participants: z.array(z.string()).nullable().optional(),
    client_participants: z.array(z.string()).nullable().optional(),
    notes: z.string().trim().nullable().optional(),
  }).optional(),
  meeting: z.object({
    service: z.string().trim().min(1),
    scheduled: z.boolean().optional(),
    scheduled_at: z.string().nullable().optional(),
    meeting_url: z.string().trim().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
  }).optional(),
  service_assignment: z.object({
    service: z.string().trim().min(1),
    leader_id: z.string().trim().nullable().optional(),
    department_id: z.string().trim().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
  }).optional(),
});

function optionalDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const onboarding = await prisma.clientOnboarding.findUnique({
    where: { id: params.id },
    include: onboardingInclude(),
  });
  if (!onboarding) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await loadOnboardingAccess(auth, onboarding.id);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(redactOnboardingContracts(onboarding, access.canViewPrivateContract));
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const access = await loadOnboardingAccess(auth, params.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding update", issues: parsed.error.flatten() }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const notificationTargets: OnboardingAssignmentNotificationTarget[] = [];
    if (parsed.data.finance) {
      if (!access.canUpdateFinance) return null;
      const startDate = optionalDate(parsed.data.finance.contract_start_date);
      if (startDate === "invalid") throw new Error("Invalid contract start date");
      const company = await tx.company.update({
        where: { id: access.onboarding.company_id },
        data: {
          ...parsed.data.finance,
          ...(startDate !== undefined && { contract_start_date: startDate }),
        },
        select: {
          legal_name: true,
          cnpj: true,
          billing_email: true,
          main_contact_email: true,
          contract_value: true,
          payment_terms: true,
          contract_start_date: true,
        },
      });
      if (financeRegistrationComplete(company)) {
        await tx.onboardingChecklistItem.updateMany({
          where: { onboarding_id: params.id, department: "Finance" },
          data: { status: "complete", completed_at: new Date(), completed_by: auth.prismaUser.id },
        });
      }
    }

    if (parsed.data.support_group) {
      if (!access.canUpdateSupport) return null;
      const support = await tx.supportGroup.update({
        where: { onboarding_id: params.id },
        data: {
          ...parsed.data.support_group,
          ...(parsed.data.support_group.group_created
            ? { group_created_at: new Date(), created_by: auth.prismaUser.id }
            : {}),
          internal_participants:
            parsed.data.support_group.internal_participants === undefined
              ? undefined
              : (parsed.data.support_group.internal_participants as Prisma.InputJsonValue),
          client_participants:
            parsed.data.support_group.client_participants === undefined
              ? undefined
              : (parsed.data.support_group.client_participants as Prisma.InputJsonValue),
        },
      });
      if (support.group_created) {
        await tx.onboardingChecklistItem.updateMany({
          where: { onboarding_id: params.id, department: "Support" },
          data: { status: "complete", completed_at: new Date(), completed_by: auth.prismaUser.id },
        });
      }
    }

    if (parsed.data.meeting) {
      if (!access.canUpdateService(parsed.data.meeting.service)) return null;
      const scheduledAt = optionalDate(parsed.data.meeting.scheduled_at);
      if (scheduledAt === "invalid") throw new Error("Invalid meeting date");
      const meeting = await tx.onboardingMeeting.update({
        where: {
          onboarding_id_service: {
            onboarding_id: params.id,
            service: parsed.data.meeting.service,
          },
        },
        data: {
          scheduled: parsed.data.meeting.scheduled ?? undefined,
          ...(scheduledAt !== undefined && { scheduled_at: scheduledAt }),
          meeting_url: parsed.data.meeting.meeting_url,
          notes: parsed.data.meeting.notes,
        },
      });
      if (meeting.scheduled && meeting.checklist_item_id) {
        await tx.onboardingChecklistItem.update({
          where: { id: meeting.checklist_item_id },
          data: { status: "complete", completed_at: new Date(), completed_by: auth.prismaUser.id },
        });
      }
    }

    if (parsed.data.service_assignment) {
      if (!access.admin) return null;
      if (parsed.data.service_assignment.leader_id) {
        const member = await tx.workspaceMember.findFirst({
          where: {
            workspace_id: access.onboarding.workspace_id,
            user_id: parsed.data.service_assignment.leader_id,
            status: "active",
            role: { not: "guest" },
          },
          select: { id: true },
        });
        if (!member) throw new Error("Selected leader is not an active workspace member.");
      }
      if (parsed.data.service_assignment.department_id) {
        const department = await tx.department.findFirst({
          where: {
            id: parsed.data.service_assignment.department_id,
            workspace_id: access.onboarding.workspace_id,
          },
          select: { id: true },
        });
        if (!department) throw new Error("Selected department does not belong to this workspace.");
      }
      await tx.onboardingServiceAssignment.update({
        where: {
          onboarding_id_service: {
            onboarding_id: params.id,
            service: parsed.data.service_assignment.service,
          },
        },
        data: {
          leader_id: parsed.data.service_assignment.leader_id ?? undefined,
          department_id: parsed.data.service_assignment.department_id ?? undefined,
          notes: parsed.data.service_assignment.notes,
          status: parsed.data.service_assignment.leader_id ? "assigned" : "unassigned",
        },
      });
      const meeting = await tx.onboardingMeeting.update({
        where: {
          onboarding_id_service: {
            onboarding_id: params.id,
            service: parsed.data.service_assignment.service,
          },
        },
        data: { leader_id: parsed.data.service_assignment.leader_id ?? null },
      });
      if (meeting.checklist_item_id) {
        const projectContext = await tx.project.findUnique({
          where: { id: access.onboarding.project_id },
          select: {
            id: true,
            owner_id: true,
            space_id: true,
            company: { select: { name: true } },
          },
        });
        if (!projectContext) throw new Error("Onboarding project not found.");
        const service = parsed.data.service_assignment.service;
        const normalizedService = service
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        const route = normalizedService.includes("meta ads")
          ? "marketing_b2b"
          : normalizedService.includes("creative")
            ? "creative_design"
            : null;
        const taskProjectId = await resolveOnboardingTaskProjectId(tx, {
          workspaceId: access.onboarding.workspace_id,
          companyId: access.onboarding.company_id,
          companyName: projectContext.company?.name ?? "Client",
          sourceProjectId: access.onboarding.project_id,
          sourceProjectSpaceId: projectContext.space_id,
          ownerId: auth.prismaUser.id,
          route,
        });
        const checklistItem = await tx.onboardingChecklistItem.update({
          where: { id: meeting.checklist_item_id },
          data: { owner_id: parsed.data.service_assignment.leader_id ?? null },
          select: { id: true, task_id: true, sort_order: true },
        });
        let taskId = checklistItem.task_id;
        if (!taskId) {
          const serviceTask = await tx.task.create({
            data: {
              project_id: taskProjectId,
              company_id: access.onboarding.company_id,
              title: `Onboarding: schedule ${service} onboarding meeting`,
              description: `Schedule the ${service} onboarding meeting and save the date/link in the onboarding workflow.`,
              status: "todo",
              priority: "medium",
              assignee_id: parsed.data.service_assignment.leader_id ?? null,
              position: checklistItem.sort_order,
            },
          });
          taskId = serviceTask.id;
          await tx.onboardingChecklistItem.update({
            where: { id: checklistItem.id },
            data: { task_id: taskId },
          });
        } else {
          await tx.task.update({
            where: { id: taskId },
            data: {
              assignee_id: parsed.data.service_assignment.leader_id ?? null,
              project_id: taskProjectId,
            },
          });
        }
        notificationTargets.push({
          userId: parsed.data.service_assignment.leader_id,
          taskId,
          workspaceId: access.onboarding.workspace_id,
          onboardingId: params.id,
          actorId: auth.prismaUser.id,
          label: `Schedule ${service} onboarding meeting`,
        });
      }
      const missingLeader = await tx.onboardingServiceAssignment.findFirst({
        where: { onboarding_id: params.id, leader_id: null },
        select: { id: true },
      });
      await tx.onboardingChecklistItem.updateMany({
        where: { onboarding_id: params.id, department: "Internal Assignment" },
        data: missingLeader
          ? { status: "pending", completed_at: null, completed_by: null }
          : { status: "complete", completed_at: new Date(), completed_by: auth.prismaUser.id },
      });
    }

    const onboarding = await recomputeOnboardingProgress(tx, params.id);
    return { onboarding, notificationTargets };
  });

  if (!result) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { onboarding: updated, notificationTargets } = result;
  await sendOnboardingAssignmentNotifications(notificationTargets);

  await recordActivity({
    workspace_id: updated.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "client_onboarding_updated",
    entity_type: "client_onboarding",
    entity_id: updated.id,
    project_id: updated.project_id,
    company_id: updated.company_id,
    metadata: { status: updated.status, progress: updated.progress },
  });

  const freshAccess = await loadOnboardingAccess(auth, params.id);
  return NextResponse.json(redactOnboardingContracts(updated, Boolean(freshAccess?.canViewPrivateContract)));
}

export const GET = withErrorReporting("api:onboarding/[id]:GET", GET_handler);
export const PATCH = withErrorReporting("api:onboarding/[id]:PATCH", PATCH_handler);
