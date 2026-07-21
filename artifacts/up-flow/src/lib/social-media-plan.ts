import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ensureSocialMediaCustomFields,
  isMoodboardReady,
  isSocialMediaPublicationOverdue,
  moodboardStatusForTaskStatus,
  SOCIAL_MEDIA_FIELD_NAMES,
} from "@/lib/social-media";

export const socialMediaPlanCalendarInclude = Prisma.validator<Prisma.SocialMediaContentPlanInclude>()({
  company: { select: { id: true, name: true } },
  moodboard_task: {
    select: { id: true, title: true, status: true, due_date: true },
  },
  content_tasks: {
    orderBy: [{ due_date: "asc" }, { position: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      due_date: true,
      assignee_id: true,
      company_id: true,
      social_media_plan_id: true,
      assignee: { select: { id: true, name: true, email: true } },
      custom_field_values: {
        select: {
          value: true,
          definition: { select: { name: true } },
        },
      },
    },
  },
});

export type SocialMediaPlanWithCalendar = Prisma.SocialMediaContentPlanGetPayload<{
  include: typeof socialMediaPlanCalendarInclude;
}>;

function stringArray(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function serializeSocialMediaContentTask(
  task: SocialMediaPlanWithCalendar["content_tasks"][number],
) {
  const custom_fields = Object.fromEntries(
    task.custom_field_values.map((field) => [field.definition.name, field.value]),
  );
  // Task.due_date is the canonical publish date. The custom field is kept in
  // sync by both task-update routes, and the serializer favors the canonical
  // value so calendar reads and overdue evaluation can never disagree.
  custom_fields[SOCIAL_MEDIA_FIELD_NAMES.scheduledPublishingDate] = task.due_date
    ? task.due_date.toISOString()
    : null;
  const storedPublishingStatus = custom_fields[SOCIAL_MEDIA_FIELD_NAMES.publishingStatus] ?? null;
  const publishingStatus =
    storedPublishingStatus === "Published" || storedPublishingStatus === "Cancelled"
      ? storedPublishingStatus
      : isSocialMediaPublicationOverdue(task.due_date)
        ? "Overdue"
        : storedPublishingStatus === "Overdue"
          ? "Not Scheduled"
          : storedPublishingStatus;
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    scheduled_publishing_date: task.due_date,
    content_type: custom_fields[SOCIAL_MEDIA_FIELD_NAMES.contentType] ?? null,
    moodboard_status: custom_fields[SOCIAL_MEDIA_FIELD_NAMES.moodboardStatus] ?? null,
    creative_production_status:
      custom_fields[SOCIAL_MEDIA_FIELD_NAMES.creativeProductionStatus] ?? null,
    approval_status: custom_fields[SOCIAL_MEDIA_FIELD_NAMES.approvalStatus] ?? null,
    publishing_status: publishingStatus,
    published_url: custom_fields[SOCIAL_MEDIA_FIELD_NAMES.publishedUrl] ?? null,
    published_at: custom_fields[SOCIAL_MEDIA_FIELD_NAMES.publishedAt] ?? null,
    assignee_id: task.assignee_id,
    assignee: task.assignee,
    designer_ids: custom_fields[SOCIAL_MEDIA_FIELD_NAMES.designer] ?? [],
    social_manager_ids: custom_fields[SOCIAL_MEDIA_FIELD_NAMES.socialMediaManager] ?? [],
    company_id: task.company_id,
    social_media_plan_id: task.social_media_plan_id,
    custom_fields,
  };
}

export function serializeSocialMediaPlan(plan: SocialMediaPlanWithCalendar) {
  const content_tasks = plan.content_tasks.map(serializeSocialMediaContentTask);
  return {
    id: plan.id,
    project_id: plan.project_id,
    company_id: plan.company_id,
    month: plan.month,
    monthly_post_target: plan.monthly_post_target,
    weekly_posting_frequency: plan.weekly_posting_frequency,
    required_formats: stringArray(plan.required_formats),
    social_manager_id: plan.social_manager_id,
    designer_id: plan.designer_id,
    moodboard_status: plan.moodboard_status,
    moodboard_ready: isMoodboardReady(plan.moodboard_status),
    moodboard_task_id: plan.moodboard_task_id,
    company: plan.company,
    content_task_ids: content_tasks.map((task) => task.id),
    content_tasks,
    moodboard_task: plan.moodboard_task,
    planned_count: content_tasks.length,
    remaining_to_target: Math.max(0, plan.monthly_post_target - content_tasks.length),
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  };
}

export async function loadSocialMediaPlanForCalendar(id: string) {
  return prisma.socialMediaContentPlan.findUnique({
    where: { id },
    include: socialMediaPlanCalendarInclude,
  });
}

type SocialMediaTransaction = Prisma.TransactionClient;

type SocialMediaContentTaskForUnlock = {
  id: string;
  status: "todo" | "in_progress" | "done";
};

async function setSocialMediaField(
  tx: SocialMediaTransaction,
  taskId: string,
  definitionId: string,
  value: Prisma.InputJsonValue,
) {
  await tx.customFieldValue.upsert({
    where: { task_id_definition_id: { task_id: taskId, definition_id: definitionId } },
    update: { value },
    create: { task_id: taskId, definition_id: definitionId, value },
  });
}

/**
 * Releasing a moodboard starts only untouched, unfinished content tasks. This
 * keeps the Social Media production column and the generic task workflow in
 * step without reopening work that has already been completed.
 */
export async function unlockSocialMediaContentProduction(
  tx: SocialMediaTransaction,
  contentTasks: SocialMediaContentTaskForUnlock[],
  fieldIds: Awaited<ReturnType<typeof ensureSocialMediaCustomFields>>,
) {
  if (contentTasks.length === 0) return [];

  const productionValues = await tx.customFieldValue.findMany({
    where: {
      task_id: { in: contentTasks.map((task) => task.id) },
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.creativeProductionStatus],
    },
    select: { task_id: true, value: true },
  });
  const valueByTaskId = new Map(productionValues.map((value) => [value.task_id, value.value]));
  const taskIds = contentTasks
    .filter((task) => {
      const productionStatus = valueByTaskId.get(task.id);
      return (
        task.status !== "done" &&
        (productionStatus === undefined ||
          productionStatus === null ||
          productionStatus === "Not Requested")
      );
    })
    .map((task) => task.id);
  if (taskIds.length === 0) return [];

  await Promise.all(
    taskIds.map((taskId) =>
      setSocialMediaField(
        tx,
        taskId,
        fieldIds[SOCIAL_MEDIA_FIELD_NAMES.creativeProductionStatus],
        "In Production",
      ),
    ),
  );
  await tx.task.updateMany({
    where: { id: { in: taskIds }, status: "todo" },
    data: { status: "in_progress" },
  });
  return taskIds;
}

/**
 * Keep a plan's calendar columns aligned when its actual moodboard Task is
 * advanced through the ordinary task UI/API. This is intentionally callable
 * from task routes as well as the dedicated Social Media endpoint.
 */
export async function syncSocialMediaMoodboardWorkflow(
  moodboardTaskId: string,
  taskStatus: "todo" | "in_progress" | "done",
) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.socialMediaContentPlan.findUnique({
      where: { moodboard_task_id: moodboardTaskId },
      select: {
        id: true,
        project_id: true,
        moodboard_status: true,
        content_tasks: { select: { id: true, status: true } },
      },
    });
    if (!plan) return null;

    const moodboardStatus = moodboardStatusForTaskStatus(taskStatus, plan.moodboard_status);
    const fieldIds = await ensureSocialMediaCustomFields(tx, plan.project_id);
    await tx.socialMediaContentPlan.update({
      where: { id: plan.id },
      data: { moodboard_status: moodboardStatus },
    });
    await setSocialMediaField(
      tx,
      moodboardTaskId,
      fieldIds[SOCIAL_MEDIA_FIELD_NAMES.moodboardStatus],
      moodboardStatus,
    );

    for (const task of plan.content_tasks) {
      await setSocialMediaField(
        tx,
        task.id,
        fieldIds[SOCIAL_MEDIA_FIELD_NAMES.moodboardStatus],
        moodboardStatus,
      );
    }

    if (isMoodboardReady(moodboardStatus)) {
      await unlockSocialMediaContentProduction(tx, plan.content_tasks, fieldIds);
    }

    return {
      id: plan.id,
      moodboard_status: moodboardStatus,
      became_ready:
        !isMoodboardReady(plan.moodboard_status) && isMoodboardReady(moodboardStatus),
    };
  });
}
