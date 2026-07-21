import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { canAssignUserToProject, canContributeToProject, canReadProject } from "@/lib/project-access";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";
import {
  ensureSocialMediaCustomFields,
  parseSocialMediaMonth,
  scheduleSocialMediaDates,
  socialMediaMonthLabel,
  SOCIAL_MEDIA_CONTENT_TYPE_OPTIONS,
  SOCIAL_MEDIA_DEFAULT_CONTENT_TYPE,
  SOCIAL_MEDIA_DEFAULT_MOODBOARD_STATUS,
  SOCIAL_MEDIA_FIELD_NAMES,
} from "@/lib/social-media";
import {
  serializeSocialMediaPlan,
  socialMediaPlanCalendarInclude,
} from "@/lib/social-media-plan";

type RouteContext = { params: Promise<{ id: string }> };

const CreatePlanSchema = z.object({
  company_id: z.string().uuid().optional(),
  month: z.string().trim().min(1),
  monthly_post_target: z.coerce.number().int().min(1).max(60),
  weekly_posting_frequency: z.coerce.number().int().min(1).max(7).default(3),
  required_formats: z.array(z.string().trim().min(1).max(80)).min(1).max(10).default([
    SOCIAL_MEDIA_DEFAULT_CONTENT_TYPE,
  ]),
  social_manager_id: z.string().uuid().nullable().optional(),
  designer_id: z.string().uuid().nullable().optional(),
});

function normalizedFormats(formats: string[]) {
  return Array.from(new Set(formats.map((format) => format.trim()).filter(Boolean)));
}

function isKnownContentFormat(format: string) {
  return SOCIAL_MEDIA_CONTENT_TYPE_OPTIONS.includes(format);
}

function socialMediaCustomFieldValues(
  taskId: string,
  fieldIds: Awaited<ReturnType<typeof ensureSocialMediaCustomFields>>,
  input: {
    dueDate: Date;
    contentType: string;
    socialManagerId: string | null;
    designerId: string | null;
    moodboardStatus: string;
    creativeProductionStatus: string;
    approvalStatus?: string;
    publishingStatus?: string;
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
      value: input.dueDate.toISOString(),
    },
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.moodboardStatus],
      value: input.moodboardStatus,
    },
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.creativeProductionStatus],
      value: input.creativeProductionStatus,
    },
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.approvalStatus],
      value: input.approvalStatus ?? "Not Requested",
    },
    {
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.publishingStatus],
      value: input.publishingStatus ?? "Not Scheduled",
    },
  ];
  if (input.socialManagerId) {
    values.push({
      task_id: taskId,
      definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.socialMediaManager],
      value: [input.socialManagerId],
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

async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      workspace_id: true,
      owner_id: true,
      company_id: true,
    },
  });
}

async function GET_handler(req: NextRequest, { params }: RouteContext) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canReadProject(auth, project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthParam = new URL(req.url).searchParams.get("month");
  const month = monthParam ? parseSocialMediaMonth(monthParam) : null;
  if (month === "invalid") {
    return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
  }

  const [plans, fields] = await Promise.all([
    prisma.socialMediaContentPlan.findMany({
      where: {
        project_id: project.id,
        ...(month ? { month } : {}),
      },
      orderBy: [{ month: "desc" }, { created_at: "desc" }],
      include: socialMediaPlanCalendarInclude,
    }),
    prisma.customFieldDefinition.findMany({
      where: {
        project_id: project.id,
        name: { in: Object.values(SOCIAL_MEDIA_FIELD_NAMES) },
      },
      orderBy: [{ position: "asc" }, { created_at: "asc" }],
    }),
  ]);

  return NextResponse.json({
    plans: plans.map(serializeSocialMediaPlan),
    custom_fields: fields,
    status_options: {
      moodboard: ["Not Started", "In Progress", "Ready", "Awaiting Approval", "Approved"],
      creative_production: [
        "Not Requested",
        "In Production",
        "In Review",
        "Awaiting Approval",
        "Approved",
        "Scheduled",
      ],
      publishing: ["Not Scheduled", "Scheduled", "Published", "Overdue", "Cancelled"],
    },
  });
}

async function POST_handler(req: NextRequest, { params }: RouteContext) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canContributeToProject(auth, project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = CreatePlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid social media plan", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const month = parseSocialMediaMonth(body.month);
  if (month === "invalid") {
    return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
  }
  const formats = normalizedFormats(body.required_formats);
  const unsupportedFormat = formats.find((format) => !isKnownContentFormat(format));
  if (unsupportedFormat) {
    return NextResponse.json(
      { error: `Unsupported content format: ${unsupportedFormat}` },
      { status: 400 },
    );
  }

  const companyId = body.company_id ?? project.company_id;
  if (!companyId) {
    return NextResponse.json(
      { error: "company_id is required for a project without a linked client" },
      { status: 400 },
    );
  }
  if (project.company_id && project.company_id !== companyId) {
    return NextResponse.json(
      { error: "A social media plan must use the client linked to its project" },
      { status: 400 },
    );
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, workspace_id: project.workspace_id },
    select: { id: true, name: true },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 });

  const socialManagerId = body.social_manager_id ?? null;
  const designerId = body.designer_id ?? null;
  for (const userId of [socialManagerId, designerId]) {
    if (userId && !(await canAssignUserToProject(project, userId))) {
      return NextResponse.json(
        { error: "Assigned team members must be active project members" },
        { status: 400 },
      );
    }
  }

  const scheduledDates = scheduleSocialMediaDates(
    month,
    body.monthly_post_target,
    body.weekly_posting_frequency,
  );
  const result = await prisma.$transaction(async (tx) => {
    // Serializing plan creation per list prevents duplicate fields, tasks, and
    // plans when a user double-submits the creation form.
    await tx.$queryRaw`
      SELECT "id" FROM "Project" WHERE "id" = ${project.id} FOR UPDATE
    `;
    const existing = await tx.socialMediaContentPlan.findFirst({
      where: { project_id: project.id, company_id: company.id, month },
      select: { id: true },
    });
    if (existing) return { kind: "exists" as const, id: existing.id };

    const fieldIds = await ensureSocialMediaCustomFields(tx, project.id);
    const lastTask = await tx.task.findFirst({
      where: { project_id: project.id },
      orderBy: [{ position: "desc" }, { created_at: "desc" }],
      select: { position: true },
    });
    const firstPosition = (lastTask?.position ?? -1) + 1;
    const plan = await tx.socialMediaContentPlan.create({
      data: {
        project_id: project.id,
        company_id: company.id,
        month,
        monthly_post_target: body.monthly_post_target,
        weekly_posting_frequency: body.weekly_posting_frequency,
        required_formats: formats as Prisma.InputJsonValue,
        social_manager_id: socialManagerId,
        designer_id: designerId,
        moodboard_status: SOCIAL_MEDIA_DEFAULT_MOODBOARD_STATUS,
      },
      select: { id: true },
    });
    const moodboardTask = await tx.task.create({
      data: {
        title: `${company.name} — Moodboard — ${socialMediaMonthLabel(month)}`,
        description: `Moodboard for the ${socialMediaMonthLabel(month)} social media content plan.`,
        project_id: project.id,
        company_id: company.id,
        assignee_id: designerId ?? socialManagerId,
        due_date: month,
        priority: "high",
        position: firstPosition,
      },
      select: { id: true },
    });
    await tx.customFieldValue.createMany({
      data: [
        {
          task_id: moodboardTask.id,
          definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.moodboardStatus],
          value: SOCIAL_MEDIA_DEFAULT_MOODBOARD_STATUS,
        },
        ...(socialManagerId
          ? [
              {
                task_id: moodboardTask.id,
                definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.socialMediaManager],
                value: [socialManagerId],
              },
            ]
          : []),
        ...(designerId
          ? [
              {
                task_id: moodboardTask.id,
                definition_id: fieldIds[SOCIAL_MEDIA_FIELD_NAMES.designer],
                value: [designerId],
              },
            ]
          : []),
      ] as Array<{
        task_id: string;
        definition_id: string;
        value: Prisma.InputJsonValue;
      }>,
    });
    await tx.socialMediaContentPlan.update({
      where: { id: plan.id },
      data: { moodboard_task_id: moodboardTask.id },
    });

    const contentTaskIds: string[] = [];
    for (const [index, dueDate] of scheduledDates.entries()) {
      const contentType = formats[index % formats.length] ?? SOCIAL_MEDIA_DEFAULT_CONTENT_TYPE;
      const task = await tx.task.create({
        data: {
          title: `${company.name} — ${contentType} — ${index + 1}`,
          description: `Scheduled ${contentType.toLowerCase()} for ${socialMediaMonthLabel(month)}.`,
          project_id: project.id,
          company_id: company.id,
          social_media_plan_id: plan.id,
          assignee_id: socialManagerId,
          due_date: dueDate,
          priority: "medium",
          position: firstPosition + index + 1,
        },
        select: { id: true },
      });
      contentTaskIds.push(task.id);
      await tx.customFieldValue.createMany({
        data: socialMediaCustomFieldValues(task.id, fieldIds, {
          dueDate,
          contentType,
          socialManagerId,
          designerId,
          moodboardStatus: SOCIAL_MEDIA_DEFAULT_MOODBOARD_STATUS,
          creativeProductionStatus: "Not Requested",
          approvalStatus: "Not Requested",
          publishingStatus: "Not Scheduled",
        }),
      });
    }

    return {
      kind: "created" as const,
      id: plan.id,
      moodboardTaskId: moodboardTask.id,
      contentTaskIds,
    };
  });

  if (result.kind === "exists") {
    return NextResponse.json(
      { error: "A social media content plan already exists for this client and month", plan_id: result.id },
      { status: 409 },
    );
  }

  await recordActivity({
    workspace_id: project.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "social_media_plan_created",
    entity_type: "social_media_plan",
    entity_id: result.id,
    project_id: project.id,
    company_id: company.id,
    metadata: {
      month: body.month,
      monthly_post_target: body.monthly_post_target,
      weekly_posting_frequency: body.weekly_posting_frequency,
      moodboard_task_id: result.moodboardTaskId,
      content_task_ids: result.contentTaskIds,
    },
  });

  const created = await prisma.socialMediaContentPlan.findUnique({
    where: { id: result.id },
    include: socialMediaPlanCalendarInclude,
  });
  if (!created) {
    return NextResponse.json({ error: "Plan creation did not complete" }, { status: 500 });
  }
  return NextResponse.json({ plan: serializeSocialMediaPlan(created) }, { status: 201 });
}

export const GET = withErrorReporting("api:projects/id/social-media:GET", GET_handler);
export const POST = withErrorReporting("api:projects/id/social-media:POST", POST_handler);
