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

  const updated = await prisma.$transaction(async (tx) => {
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
      await tx.onboardingMeeting.update({
        where: {
          onboarding_id_service: {
            onboarding_id: params.id,
            service: parsed.data.service_assignment.service,
          },
        },
        data: { leader_id: parsed.data.service_assignment.leader_id ?? null },
      });
    }

    return recomputeOnboardingProgress(tx, params.id);
  });

  if (!updated) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
