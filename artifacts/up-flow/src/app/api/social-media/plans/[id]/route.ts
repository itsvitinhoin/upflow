import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { canContributeToProject } from "@/lib/project-access";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { notifySocialMediaWorkflow } from "@/lib/social-media-notifications";
import {
  ensureSocialMediaCustomFields,
  isMoodboardReady,
  moodboardTaskStatusFor,
  SOCIAL_MEDIA_FIELD_NAMES,
  SOCIAL_MEDIA_MOODBOARD_STATUS_OPTIONS,
} from "@/lib/social-media";
import type { SocialMediaMoodboardStatus } from "@/lib/social-media";
import {
  serializeSocialMediaPlan,
  socialMediaPlanCalendarInclude,
  unlockSocialMediaContentProduction,
} from "@/lib/social-media-plan";

type RouteContext = { params: Promise<{ id: string }> };

const UpdatePlanSchema = z.object({
  moodboard_status: z.enum(SOCIAL_MEDIA_MOODBOARD_STATUS_OPTIONS as [string, ...string[]]),
});

async function PATCH_handler(req: NextRequest, { params }: RouteContext) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const existing = await prisma.socialMediaContentPlan.findUnique({
    where: { id },
    select: {
      id: true,
      project_id: true,
      company_id: true,
      moodboard_status: true,
      moodboard_task_id: true,
      moodboard_task: { select: { title: true } },
      project: { select: { id: true, workspace_id: true, owner_id: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Social media plan not found" }, { status: 404 });
  if (!(await canContributeToProject(auth, existing.project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = UpdatePlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid social media plan update", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const moodboardStatus = parsed.data.moodboard_status as SocialMediaMoodboardStatus;

  await prisma.$transaction(async (tx) => {
    const plan = await tx.socialMediaContentPlan.findUnique({
      where: { id: existing.id },
      select: {
        id: true,
        project_id: true,
        moodboard_task_id: true,
        content_tasks: { select: { id: true, status: true } },
      },
    });
    if (!plan) throw new Error("Social media plan no longer exists");

    const fields = await ensureSocialMediaCustomFields(tx, plan.project_id);
    await tx.socialMediaContentPlan.update({
      where: { id: plan.id },
      data: { moodboard_status: moodboardStatus },
    });

    const taskIds = [plan.moodboard_task_id, ...plan.content_tasks.map((task) => task.id)].filter(
      (taskId): taskId is string => Boolean(taskId),
    );
    if (taskIds.length) {
      await Promise.all(
        taskIds.map((taskId) =>
          tx.customFieldValue.upsert({
            where: {
              task_id_definition_id: {
                task_id: taskId,
                definition_id: fields[SOCIAL_MEDIA_FIELD_NAMES.moodboardStatus],
              },
            },
            update: { value: moodboardStatus },
            create: {
              task_id: taskId,
              definition_id: fields[SOCIAL_MEDIA_FIELD_NAMES.moodboardStatus],
              value: moodboardStatus,
            },
          }),
        ),
      );
    }

    if (plan.moodboard_task_id) {
      await tx.task.update({
        where: { id: plan.moodboard_task_id },
        data: { status: moodboardTaskStatusFor(moodboardStatus) },
      });
    }

    // Releasing a ready or approved moodboard opens only untouched,
    // unfinished content work, including its generic Task status.
    if (isMoodboardReady(moodboardStatus) && plan.content_tasks.length) {
      await unlockSocialMediaContentProduction(tx, plan.content_tasks, fields);
    }
  });

  await recordActivity({
    workspace_id: existing.project.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "social_media_moodboard_updated",
    entity_type: "social_media_plan",
    entity_id: existing.id,
    project_id: existing.project_id,
    company_id: existing.company_id,
    metadata: {
      old_moodboard_status: existing.moodboard_status,
      new_moodboard_status: moodboardStatus,
    } as Prisma.InputJsonValue,
  });

  if (
    existing.moodboard_task_id &&
    !isMoodboardReady(existing.moodboard_status) &&
    isMoodboardReady(moodboardStatus)
  ) {
    await notifySocialMediaWorkflow({
      source: "social_media_moodboard_ready",
      planId: existing.id,
      taskId: existing.moodboard_task_id,
      taskTitle: existing.moodboard_task?.title ?? "Social Media moodboard",
      actorId: auth.prismaUser.id,
      actorName: auth.prismaUser.name,
    });
  }

  const plan = await prisma.socialMediaContentPlan.findUnique({
    where: { id: existing.id },
    include: socialMediaPlanCalendarInclude,
  });
  if (!plan) return NextResponse.json({ error: "Social media plan not found" }, { status: 404 });
  return NextResponse.json({ plan: serializeSocialMediaPlan(plan) });
}

export const PATCH = withErrorReporting("api:social-media/plans/id:PATCH", PATCH_handler);
