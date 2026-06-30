import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { financeRegistrationComplete, loadOnboardingAccess, recomputeOnboardingProgress } from "@/lib/onboarding";
import { withErrorReporting } from "@/lib/with-error-reporting";

const ItemSchema = z.object({
  status: z.enum(["pending", "in_progress", "complete"]).optional(),
  notes: z.string().trim().nullable().optional(),
  owner_id: z.string().trim().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

async function getCompletionBlocker(
  db: typeof prisma | Prisma.TransactionClient,
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
      where: { onboarding_id: onboardingId, leader_id: null },
      select: { id: true },
    });
    if (missingLeader) return "Assign leaders for every contracted service before marking Internal Assignment done.";
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

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const access = await loadOnboardingAccess(auth, params.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.onboardingChecklistItem.findFirst({
    where: { id: params.itemId, onboarding_id: params.id },
    select: { id: true, department: true, owner_id: true, title: true },
  });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (!access.canUpdateChecklistItem(item)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = ItemSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checklist item", issues: parsed.error.flatten() }, { status: 400 });
  }

  const dueDate =
    parsed.data.due_date === undefined || parsed.data.due_date === null || parsed.data.due_date === ""
      ? parsed.data.due_date === undefined
        ? undefined
        : null
      : new Date(parsed.data.due_date);
  if (dueDate instanceof Date && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
  }

  if (parsed.data.status === "complete") {
    const blocker = await getCompletionBlocker(prisma, params.id, item);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.onboardingChecklistItem.update({
      where: { id: params.itemId },
      data: {
        status: parsed.data.status,
        notes: parsed.data.notes,
        owner_id: access.admin ? parsed.data.owner_id : undefined,
        ...(dueDate !== undefined && { due_date: dueDate }),
        ...(parsed.data.status === "complete"
          ? { completed_at: new Date(), completed_by: auth.prismaUser.id }
          : parsed.data.status
            ? { completed_at: null, completed_by: null }
            : {}),
      },
    });
    return recomputeOnboardingProgress(tx, params.id);
  });

  await recordActivity({
    workspace_id: updated.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "client_onboarding_item_updated",
    entity_type: "client_onboarding",
    entity_id: updated.id,
    project_id: updated.project_id,
    company_id: updated.company_id,
    metadata: { item_id: params.itemId, status: parsed.data.status },
  });

  return NextResponse.json(updated);
}

export const PATCH = withErrorReporting("api:onboarding/items:PATCH", PATCH_handler);
