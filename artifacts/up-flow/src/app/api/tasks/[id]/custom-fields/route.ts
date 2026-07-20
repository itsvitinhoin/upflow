import { NextRequest, NextResponse } from "next/server";
import { Prisma, type TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isEmptyValue, validateCustomFieldValue } from "@/lib/custom-field-validator";
import { withErrorReporting } from "@/lib/with-error-reporting";
import {
  getOnboardingTaskCompletionBlocker,
  getOnboardingTaskStartBlocker,
  syncOnboardingChecklistFromTaskStatus,
} from "@/lib/onboarding";
import { canContributeToProject } from "@/lib/project-access";
import { recordActivity } from "@/lib/activity";

type RouteContext = { params: Promise<{ id: string }> };

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "todo" || value === "in_progress" || value === "done";
}

async function PUT_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      project_id: true,
      status: true,
      project: { select: { id: true, workspace_id: true, owner_id: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canContributeToProject(auth, task.project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    definition_id?: string;
    value?: unknown;
    task_status?: TaskStatus;
  };
  if (!body.definition_id) {
    return NextResponse.json({ error: "definition_id is required" }, { status: 400 });
  }
  if (body.task_status !== undefined && !isTaskStatus(body.task_status)) {
    return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
  }

  const def = await prisma.customFieldDefinition.findUnique({
    where: { id: body.definition_id },
    select: { project_id: true, name: true, type: true, options: true },
  });
  if (!def || def.project_id !== task.project_id) {
    return NextResponse.json({ error: "Field not in this project" }, { status: 400 });
  }

  const taskStatusChanged = body.task_status !== undefined && body.task_status !== task.status;
  if (body.task_status === "done" && taskStatusChanged) {
    const blocker = await getOnboardingTaskCompletionBlocker(prisma, task.id);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  }
  if (body.task_status === "in_progress" && taskStatusChanged) {
    const blocker = await getOnboardingTaskStartBlocker(prisma, task.id);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  }

  const updateTaskStatus = async (tx: Prisma.TransactionClient) => {
    if (!taskStatusChanged) return;
    await tx.task.update({
      where: { id: task.id },
      data: { status: body.task_status },
    });
  };

  if (isEmptyValue(body.value)) {
    await prisma.$transaction(async (tx) => {
      await tx.customFieldValue.deleteMany({
        where: { task_id: task.id, definition_id: body.definition_id },
      });
      await updateTaskStatus(tx);
    });
  } else {
    const validated = validateCustomFieldValue(def, body.value);
    if (!validated.ok) {
      return NextResponse.json(
        { error: `Invalid value for "${def.name}": ${validated.error}` },
        { status: 400 },
      );
    }

    // People-type fields: ensure every referenced id is a workspace member.
    if (def.type === "people" && Array.isArray(validated.value)) {
      const ids = (validated.value as string[]).filter((s) => typeof s === "string");
      if (ids.length > 0) {
        const members = await prisma.workspaceMember.findMany({
          where: {
            workspace_id: task.project.workspace_id,
            user_id: { in: ids },
          },
          select: { user_id: true },
        });
        const memberSet = new Set(members.map((member) => member.user_id));
        const bad = ids.find((memberId) => !memberSet.has(memberId));
        if (bad) {
          return NextResponse.json(
            {
              error: `Invalid value for "${def.name}": user ${bad} is not a member of this workspace`,
            },
            { status: 400 },
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.customFieldValue.upsert({
        where: {
          task_id_definition_id: {
            task_id: task.id,
            definition_id: body.definition_id!,
          },
        },
        update: { value: validated.value as Prisma.InputJsonValue },
        create: {
          task_id: task.id,
          definition_id: body.definition_id!,
          value: validated.value as Prisma.InputJsonValue,
        },
      });
      await updateTaskStatus(tx);
    });
  }

  const onboardingSync = taskStatusChanged
    ? await syncOnboardingChecklistFromTaskStatus(prisma, {
        taskId: task.id,
        status: body.task_status!,
        actorId: auth.prismaUser.id,
      })
    : null;
  if (taskStatusChanged) {
    await recordActivity({
      workspace_id: task.project.workspace_id,
      actor_id: auth.prismaUser.id,
      type: "task_status_changed",
      entity_type: "task",
      entity_id: task.id,
      project_id: task.project_id,
      task_id: task.id,
      metadata: { old_status: task.status, new_status: body.task_status, source: "custom_field" },
    });
  }

  return NextResponse.json({
    ok: true,
    value: isEmptyValue(body.value) ? null : body.value,
    onboarding_sync: onboardingSync,
  });
}

export const PUT = withErrorReporting("api:tasks/id/custom-fields:PUT", PUT_handler);
