import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { canAssignUserToProject, canContributeToProject } from "@/lib/project-access";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { parseAppDate } from "@/lib/utils";
import {
  ensureSocialMediaCustomFields,
  isDateInSocialMediaMonth,
  isMoodboardReady,
  nextSocialMediaScheduledDate,
  SOCIAL_MEDIA_CONTENT_TYPE_OPTIONS,
  SOCIAL_MEDIA_FIELD_NAMES,
} from "@/lib/social-media";

import { notifyTaskAssignee } from "@/lib/task-assignment-notifications";
type RouteContext = { params: Promise<{ id: string }> };

const CreatePostSchema = z.object({
  title: z.string().trim().min(1).max(180),
  content_type: z.string().trim().min(1).max(80),
  scheduled_date: z.string().trim().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  designer_id: z.string().uuid().nullable().optional(),
});

function postFieldValues(
  taskId: string,
  fieldIds: Awaited<ReturnType<typeof ensureSocialMediaCustomFields>>,
  input: {
    scheduledDate: Date;
    contentType: string;
    moodboardStatus: string;
    productionStatus: string;
    managerId: string | null;
    designerId: string | null;
  },
) {
  const values: Array<{
    task_id: string;
    definition_id: string;
    value: Prisma.InputJsonValue;
  }> = [
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.contentType],
      value: input.contentType,
    },
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.scheduledPublishingDate],
      value: input.scheduledDate.toISOString(),
    },
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.moodboardStatus],
      value: input.moodboardStatus,
    },
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.creativeProductionStatus],
      value: input.productionStatus,
    },
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.approvalStatus],
      value: "Not Requested",
    },
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.publishingStatus],
      value: "Not Scheduled",
    },
  ];
  if (input.managerId) {
    values.push({
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.socialMediaManager],
      value: [input.managerId],
    });
  }
  if (input.designerId) {
    values.push({
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.designer],
      value: [input.designerId],
    });
  }
  return values;
}

async function POST_handler(req: NextRequest, { params }: RouteContext) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const plan = await prisma.socialMediaContentPlan.findUnique({
    where: { id },
    select: {
      id: true,
      project_id: true,
      company_id: true,
      month: true,
      weekly_posting_frequency: true,
      moodboard_status: true,
      social_manager_id: true,
      designer_id: true,
      project: { select: { id: true, workspace_id: true, owner_id: true } },
      content_tasks: { select: { due_date: true } },
    },
  });
  if (!plan) return NextResponse.json({ error: "Social media plan not found" }, { status: 404 });
  if (!(await canContributeToProject(auth, plan.project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = CreatePostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid social media content item", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  if (!SOCIAL_MEDIA_CONTENT_TYPE_OPTIONS.includes(body.content_type)) {
    return NextResponse.json({ error: "Unsupported content format" }, { status: 400 });
  }

  const assigneeId = body.assignee_id ?? plan.social_manager_id;
  const designerId = body.designer_id ?? plan.designer_id;
  for (const userId of [assigneeId, designerId]) {
    if (userId && !(await canAssignUserToProject(plan.project, userId))) {
      return NextResponse.json(
        { error: "Assigned team members must be active project members" },
        { status: 400 },
      );
    }
  }

  const parsedDate = body.scheduled_date ? parseAppDate(body.scheduled_date) : null;
  if (parsedDate === "invalid") {
    return NextResponse.json({ error: "Invalid scheduled publishing date" }, { status: 400 });
  }
  const scheduledDate =
    parsedDate ??
    nextSocialMediaScheduledDate(
      plan.month,
      plan.weekly_posting_frequency,
      plan.content_tasks.map((task) => task.due_date),
    );
  if (!isDateInSocialMediaMonth(scheduledDate, plan.month)) {
    return NextResponse.json(
      { error: "Scheduled publishing date must be in the plan month" },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const fields = await ensureSocialMediaCustomFields(tx, plan.project_id);
    const lastTask = await tx.task.findFirst({
      where: { project_id: plan.project_id },
      orderBy: [{ position: "desc" }, { created_at: "desc" }],
      select: { position: true },
    });
    const productionStatus = isMoodboardReady(plan.moodboard_status)
      ? "In Production"
      : "Not Requested";
    const task = await tx.task.create({
      data: {
        title: body.title,
        project_id: plan.project_id,
        company_id: plan.company_id,
        social_media_plan_id: plan.id,
        assignee_id: assigneeId,
        due_date: scheduledDate,
        priority: "medium",
        status: isMoodboardReady(plan.moodboard_status) ? "in_progress" : "todo",
        position: (lastTask?.position ?? -1) + 1,
      },
      select: { id: true, due_date: true },
    });
    await tx.customFieldValue.createMany({
      data: postFieldValues(task.id, fields, {
        scheduledDate,
        contentType: body.content_type,
        moodboardStatus: plan.moodboard_status,
        productionStatus,
        managerId: assigneeId,
        designerId,
      }),
    });
    return task;
  });

  await notifyTaskAssignee({
    taskId: created.id,
    userId: assigneeId,
    workspaceId: plan.project.workspace_id,
  });
  await recordActivity({
    workspace_id: plan.project.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "social_media_content_item_created",
    entity_type: "task",
    entity_id: created.id,
    project_id: plan.project_id,
    task_id: created.id,
    company_id: plan.company_id,
    metadata: {
      social_media_plan_id: plan.id,
      content_type: body.content_type,
      scheduled_date: created.due_date?.toISOString() ?? null,
    } as Prisma.InputJsonValue,
  });

  return NextResponse.json({ task: created }, { status: 201 });
}

export const POST = withErrorReporting("api:social-media/plans/id/posts:POST", POST_handler);
