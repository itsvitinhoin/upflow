import { NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { broadcastNotification } from "@/lib/supabase-server";
import { recordActivity } from "@/lib/activity";
import { parseAppDate } from "@/lib/utils";
import { parseTaskImageUrl } from "@/lib/task-images";
import { deleteTasksByIds } from "@/lib/task-delete";
import {
  getOnboardingTaskStartBlocker,
  getOnboardingTaskCompletionBlocker,
  loadOnboardingAccess,
  syncOnboardingChecklistFromTaskStatus,
} from "@/lib/onboarding";
import {
  canAssignUserToProject,
  canContributeToProject,
  canReadProject,
} from "@/lib/project-access";
import { buildTaskOnboardingLink } from "@/lib/task-onboarding-links";
import { syncSocialMediaMoodboardWorkflow } from "@/lib/social-media-plan";
import { notifySocialMediaWorkflow } from "@/lib/social-media-notifications";
import {
  ensureSocialMediaCustomFields,
  isDateInSocialMediaMonth,
  isSocialMediaPublicationOverdue,
  SOCIAL_MEDIA_FIELD_NAMES,
} from "@/lib/social-media";

const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  cover_image_url: z.string().trim().max(2_000).nullable().optional(),
  due_date: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function parsePatchDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return parseAppDate(value);
}

async function GET_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true, workspace_id: true, owner_id: true } },
      subtasks: {
        include: { assignee: { select: { id: true, name: true, email: true } } },
        orderBy: { created_at: "asc" },
      },
      comments: {
        where: { parent_id: null },
        include: {
          author: { select: { id: true, name: true } },
          replies: {
            include: { author: { select: { id: true, name: true } } },
            orderBy: { created_at: "asc" },
          },
        },
        orderBy: { created_at: "asc" },
      },
      dependencies: {
        include: {
          depends_on: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              due_date: true,
              project: { select: { id: true, name: true } },
              assignee: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
      dependents: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              due_date: true,
              project: { select: { id: true, name: true } },
              assignee: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { created_at: "asc" },
      },
      marketing_b2b_onboarding_form: {
        select: { id: true, status: true, completed_at: true },
      },
      marketing_b2c_onboarding_form: {
        select: { id: true, status: true, completed_at: true },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canReadProject(auth, task.project)) && task.assignee_id !== auth.prismaUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const onboardingLink = await prisma.onboardingChecklistItem.findFirst({
    where: { task_id: task.id },
    select: {
      id: true,
      task_id: true,
      onboarding_id: true,
      department: true,
      title: true,
      automation_key: true,
      status: true,
      onboarding: {
        select: {
          company_id: true,
          progress: true,
          company: { select: { name: true } },
        },
      },
      marketing_b2b_form: { select: { id: true } },
      marketing_b2c_form: { select: { id: true } },
      meetings: { select: { id: true, service: true } },
    },
  });

  return NextResponse.json({
    ...task,
    onboarding_link: onboardingLink ? buildTaskOnboardingLink(onboardingLink) : null,
  });
}

async function PATCH_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const { prismaUser } = auth;

  const oldTask = await prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, workspace_id: true, owner_id: true } },
      social_media_plan: { select: { month: true } },
    },
  });
  if (!oldTask) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canReadProject(auth, oldTask.project)) && oldTask.assignee_id !== prismaUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = UpdateTaskSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data as {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee_id?: string | null;
    cover_image_url?: string | null;
    due_date?: string | null;
    position?: number;
  };
  const { title, description, status, priority, assignee_id, cover_image_url, due_date, position } = body;
  const canContribute = await canContributeToProject(auth, oldTask.project);
  const canReassignTask = canContribute;
  const onboardingItem = await prisma.onboardingChecklistItem.findFirst({
    where: { task_id: id },
    select: { id: true, onboarding_id: true, department: true, owner_id: true, title: true },
  });
  const onboardingAccess = onboardingItem ? await loadOnboardingAccess(auth, onboardingItem.onboarding_id) : null;
  const changedKeys = Object.entries(body)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  const isStatusOnlyPatch = changedKeys.length === 1 && status !== undefined;
  const canUpdateDepartmentOnboardingStatus = Boolean(
    onboardingItem && isStatusOnlyPatch && onboardingAccess?.canUpdateChecklistItem(onboardingItem),
  );
  if (!canContribute && !canUpdateDepartmentOnboardingStatus) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsedDueDate = parsePatchDate(due_date);
  if (parsedDueDate === "invalid") {
    return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
  }
  if (
    parsedDueDate &&
    oldTask.social_media_plan?.month &&
    !isDateInSocialMediaMonth(parsedDueDate, oldTask.social_media_plan.month)
  ) {
    return NextResponse.json(
      { error: "Scheduled publishing date must be in the plan month" },
      { status: 400 },
    );
  }
  const parsedCoverImage = cover_image_url === undefined ? undefined : parseTaskImageUrl(cover_image_url);
  if (parsedCoverImage === "invalid") {
    return NextResponse.json(
      { error: "Invalid cover_image_url. Upload an image or use an HTTPS image URL." },
      { status: 400 },
    );
  }

  if (assignee_id !== undefined && !canReassignTask) {
    return NextResponse.json({ error: "Only project contributors can reassign tasks" }, { status: 403 });
  }

  if (assignee_id) {
    if (!(await canAssignUserToProject(oldTask.project, assignee_id))) {
      return NextResponse.json(
        { error: "Assignee is not an active member with access to this project" },
        { status: 400 },
      );
    }
  }

  if (status === "done" && status !== oldTask.status) {
    const blocker = await getOnboardingTaskCompletionBlocker(prisma, id);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  }
  if (status === "in_progress" && status !== oldTask.status) {
    const blocker = await getOnboardingTaskStartBlocker(prisma, id);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  }

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(assignee_id !== undefined && { assignee_id: assignee_id || null }),
        ...(parsedCoverImage !== undefined && { cover_image_url: parsedCoverImage }),
        ...(parsedDueDate !== undefined && { due_date: parsedDueDate }),
        ...(position !== undefined && { position }),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        marketing_b2b_onboarding_form: {
          select: { id: true, status: true, completed_at: true },
        },
        marketing_b2c_onboarding_form: {
          select: { id: true, status: true, completed_at: true },
        },
      },
    });

    // Task.due_date is the canonical Social Media publication date. Keep the
    // visible calendar field synchronized whenever it is edited generically.
    if (parsedDueDate !== undefined && oldTask.social_media_plan_id) {
      const fields = await ensureSocialMediaCustomFields(tx, oldTask.project_id);
      if (parsedDueDate) {
        await tx.customFieldValue.upsert({
          where: {
            task_id_definition_id: {
              task_id: oldTask.id,
              definition_id: fields[SOCIAL_MEDIA_FIELD_NAMES.scheduledPublishingDate],
            },
          },
          update: { value: parsedDueDate.toISOString() },
          create: {
            task_id: oldTask.id,
            definition_id: fields[SOCIAL_MEDIA_FIELD_NAMES.scheduledPublishingDate],
            value: parsedDueDate.toISOString(),
          },
        });
        if (!isSocialMediaPublicationOverdue(parsedDueDate)) {
          await tx.customFieldValue.updateMany({
            where: {
              task_id: oldTask.id,
              definition_id: fields[SOCIAL_MEDIA_FIELD_NAMES.publishingStatus],
              value: { equals: "Overdue" },
            },
            data: { value: "Not Scheduled" },
          });
        }
      } else {
        await tx.customFieldValue.deleteMany({
          where: {
            task_id: oldTask.id,
            definition_id: fields[SOCIAL_MEDIA_FIELD_NAMES.scheduledPublishingDate],
          },
        });
      }
    }
    return updated;
  });

  const onboardingSync =
    status !== undefined && status !== oldTask.status
      ? await syncOnboardingChecklistFromTaskStatus(prisma, {
          taskId: task.id,
          status,
          actorId: prismaUser.id,
        })
      : null;
  const socialMediaMoodboardSync =
    status !== undefined && status !== oldTask.status
      ? await syncSocialMediaMoodboardWorkflow(task.id, status)
      : null;
  if (socialMediaMoodboardSync?.became_ready) {
    await notifySocialMediaWorkflow({
      source: "social_media_moodboard_ready",
      planId: socialMediaMoodboardSync.id,
      taskId: task.id,
      taskTitle: task.title,
      actorId: prismaUser.id,
      actorName: prismaUser.name,
    });
  }

  if (assignee_id && assignee_id !== oldTask.assignee_id) {
    await prisma.notification
      .create({ data: { type: "assigned", user_id: assignee_id, task_id: task.id } })
      .catch((err) => logError("api:tasks:PATCH:notify", err, { task_id: task.id }));
    await broadcastNotification(assignee_id).catch((err) =>
      logError("api:tasks:PATCH:broadcast", err, { task_id: task.id, user_id: assignee_id }),
    );
  }

  // Status-change notifications. Notify the project owner (creator) and the
  // task's assignee — excluding whoever made the change, and skipping
  // duplicates when those are the same person.
  if (status !== undefined && status !== oldTask.status) {
    const recipients = new Set<string>();
    if (oldTask.project.owner_id && oldTask.project.owner_id !== prismaUser.id) {
      recipients.add(oldTask.project.owner_id);
    }
    // Use the post-update assignee so a status change combined with a
    // re-assignment still notifies the new assignee about the new status.
    const currentAssignee = task.assignee_id;
    if (currentAssignee && currentAssignee !== prismaUser.id) {
      recipients.add(currentAssignee);
    }

    const payload = {
      old_status: oldTask.status,
      new_status: status,
      task_title: task.title,
      actor_id: prismaUser.id,
      actor_name: prismaUser.name,
    };

    for (const userId of recipients) {
      await prisma.notification
        .create({
          data: {
            type: "status_changed",
            user_id: userId,
            task_id: task.id,
            data: payload,
          },
        })
        .catch((err) =>
          logError("api:tasks:PATCH:status-notify", err, { task_id: task.id, user_id: userId }),
        );
      await broadcastNotification(userId).catch((err) =>
        logError("api:tasks:PATCH:status-broadcast", err, { task_id: task.id, user_id: userId }),
      );
    }
  }

  await recordActivity({
    workspace_id: oldTask.project.workspace_id,
    actor_id: prismaUser.id,
    type: status !== undefined && status !== oldTask.status ? "task_status_changed" : "task_updated",
    entity_type: "task",
    entity_id: task.id,
    project_id: task.project_id,
    task_id: task.id,
    metadata: {
      title: task.title,
      old_status: oldTask.status,
      new_status: task.status,
    },
  });

  return NextResponse.json(
    onboardingSync?.linked || socialMediaMoodboardSync
      ? {
          ...task,
          ...(onboardingSync?.linked ? { onboarding_sync: onboardingSync } : {}),
          ...(socialMediaMoodboardSync
            ? { social_media_moodboard_sync: socialMediaMoodboardSync }
            : {}),
        }
      : task,
  );
}

async function DELETE_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id } = await params;

  const { prismaUser } = auth;

  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { id: true, workspace_id: true, owner_id: true } } },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canContributeToProject(auth, task.project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await recordActivity({
    workspace_id: task.project.workspace_id,
    actor_id: prismaUser.id,
    type: "task_deleted",
    entity_type: "task",
    entity_id: task.id,
    project_id: task.project_id,
    task_id: task.id,
    metadata: { title: task.title },
  });
  const deleted = await prisma.$transaction((tx) => deleteTasksByIds(tx, [id]));
  return NextResponse.json({ success: true, deleted });
}
export const GET = withErrorReporting("api:tasks/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:tasks/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:tasks/id:DELETE", DELETE_handler);
