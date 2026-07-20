import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessWorkspace, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { prisma } from "@/lib/prisma";
import {
  isValidStatusColor,
  normalizeSpaceTaskStatusName,
  spaceTaskStatusKey,
} from "@/lib/space-task-status";
import { syncSpaceTaskStatusFields } from "@/lib/space-workflow-statuses";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";
import {
  isSpaceWorkflowSchemaUnavailable,
  SPACE_WORKFLOW_SCHEMA_PENDING_MESSAGE,
} from "@/lib/space-workflow-schema";

type RouteContext = { params: Promise<{ id: string }> };

const StatusSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  color: z.string().trim().refine(isValidStatusColor, "Use a hex color such as #3b82f6"),
  terminal: z.boolean(),
});

const SaveWorkflowSchema = z.object({
  statuses: z.array(StatusSchema).min(1).max(30),
});

async function loadSpace(id: string, workspaceId: string | null) {
  if (!workspaceId) return null;
  return prisma.space.findFirst({
    where: { id, workspace_id: workspaceId },
    select: { id: true, workspace_id: true, name: true },
  });
}

async function GET_handler(_req: NextRequest, { params }: RouteContext) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;
  const space = await loadSpace(id, auth.currentWorkspaceId);
  if (!space || !canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const loadItems = () =>
    prisma.workflowStatus.findMany({
      where: {
        workspace_id: space.workspace_id,
        space_id: space.id,
        project_id: null,
        category: "task",
        active: true,
      },
      orderBy: [{ stage_order: "asc" }, { name: "asc" }, { id: "asc" }],
    });
  let items: Awaited<ReturnType<typeof loadItems>>;
  try {
    items = await loadItems();
  } catch (error) {
    if (isSpaceWorkflowSchemaUnavailable(error)) {
      return NextResponse.json({ error: SPACE_WORKFLOW_SCHEMA_PENDING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
  if (items.length) return NextResponse.json({ items });

  const projects = await prisma.project.findMany({
    where: { workspace_id: space.workspace_id, space_id: space.id },
    select: { id: true },
  });
  if (!projects.length) return NextResponse.json({ items, suggested: [] });

  const projectStatuses = await prisma.workflowStatus.findMany({
    where: {
      workspace_id: space.workspace_id,
      project_id: { in: projects.map((project) => project.id) },
      category: "task",
      active: true,
    },
    orderBy: [{ stage_order: "asc" }, { name: "asc" }, { id: "asc" }],
  });
  const suggested = Array.from(
    projectStatuses.reduce((unique, status) => {
      const identity = normalizeSpaceTaskStatusName(status.name);
      if (!unique.has(identity)) unique.set(identity, status);
      return unique;
    }, new Map<string, (typeof projectStatuses)[number]>()).values(),
  );
  return NextResponse.json({ items, suggested });
}

async function PUT_handler(req: NextRequest, { params }: RouteContext) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;
  const space = await loadSpace(id, auth.currentWorkspaceId);
  if (!space || !canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isWorkspaceAdminFor(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = SaveWorkflowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Space workflow", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const normalizedNames = parsed.data.statuses.map((status) => normalizeSpaceTaskStatusName(status.name));
  const keys = parsed.data.statuses.map((status) => spaceTaskStatusKey(status.name));
  if (new Set(normalizedNames).size !== normalizedNames.length || new Set(keys).size !== keys.length) {
    return NextResponse.json({ error: "Each task status needs a unique name" }, { status: 400 });
  }
  if (!parsed.data.statuses.some((status) => status.terminal)) {
    return NextResponse.json(
      { error: "Mark at least one status as complete" },
      { status: 400 },
    );
  }

  const loadExisting = () =>
    prisma.workflowStatus.findMany({
      where: {
        workspace_id: space.workspace_id,
        space_id: space.id,
        project_id: null,
        category: "task",
      },
      select: { id: true, key: true, name: true },
    });
  let existing: Awaited<ReturnType<typeof loadExisting>>;
  try {
    existing = await loadExisting();
  } catch (error) {
    if (isSpaceWorkflowSchemaUnavailable(error)) {
      return NextResponse.json({ error: SPACE_WORKFLOW_SCHEMA_PENDING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
  const existingById = new Map(existing.map((status) => [status.id, status]));
  const existingByKey = new Map(existing.map((status) => [status.key, status]));
  const requestedIds = new Set(parsed.data.statuses.flatMap((status) => (status.id ? [status.id] : [])));
  if (Array.from(requestedIds).some((statusId) => !existingById.has(statusId))) {
    return NextResponse.json({ error: "A task status no longer belongs to this Space" }, { status: 409 });
  }

  const desired = parsed.data.statuses.map((status, index) => {
    const current = status.id ? existingById.get(status.id) : existingByKey.get(spaceTaskStatusKey(status.name));
    return {
      id: current?.id,
      key: current?.key ?? spaceTaskStatusKey(status.name),
      name: status.name,
      color: status.color.toLowerCase(),
      terminal: status.terminal,
      stage_order: index,
      previousName: current?.name,
    };
  });
  if (new Set(desired.flatMap((status) => (status.id ? [status.id] : []))).size !== desired.filter((status) => status.id).length) {
    return NextResponse.json({ error: "A task status was submitted more than once" }, { status: 400 });
  }

  const saveWorkflow = () =>
    prisma.$transaction(async (tx) => {
      const renamedValues = new Map<string, string>();
      const saved = [] as Array<{
        id: string;
        key: string;
        name: string;
        color: string | null;
        terminal: boolean;
        active: boolean;
        stage_order: number;
      }>;

      for (const status of desired) {
        const record = status.id
          ? await tx.workflowStatus.update({
              where: { id: status.id },
              data: {
                name: status.name,
                color: status.color,
                terminal: status.terminal,
                active: true,
                stage_order: status.stage_order,
              },
            })
          : await tx.workflowStatus.create({
              data: {
                workspace_id: space.workspace_id,
                space_id: space.id,
                project_id: null,
                category: "task",
                key: status.key,
                name: status.name,
                color: status.color,
                terminal: status.terminal,
                active: true,
                stage_order: status.stage_order,
              },
            });
        if (status.previousName && status.previousName !== record.name) {
          renamedValues.set(status.previousName, record.name);
        }
        saved.push(record);
      }

      const savedIds = saved.map((status) => status.id);
      await tx.workflowStatus.updateMany({
        where: {
          workspace_id: space.workspace_id,
          space_id: space.id,
          project_id: null,
          category: "task",
          id: { notIn: savedIds },
          active: true,
        },
        data: { active: false },
      });

      const sync = await syncSpaceTaskStatusFields(tx, {
        workspaceId: space.workspace_id,
        spaceId: space.id,
        statuses: saved,
        renamedValues,
      });
      return { items: saved, sync };
    });
  let result: Awaited<ReturnType<typeof saveWorkflow>>;
  try {
    result = await saveWorkflow();
  } catch (error) {
    if (isSpaceWorkflowSchemaUnavailable(error)) {
      return NextResponse.json({ error: SPACE_WORKFLOW_SCHEMA_PENDING_MESSAGE }, { status: 503 });
    }
    throw error;
  }

  await recordActivity({
    workspace_id: space.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "space_workflow_statuses_updated",
    entity_type: "space",
    entity_id: space.id,
    metadata: { status_count: result.items.length, project_count: result.sync.projectCount },
  });

  return NextResponse.json(result);
}

export const GET = withErrorReporting("api:spaces/id/workflow-statuses:GET", GET_handler);
export const PUT = withErrorReporting("api:spaces/id/workflow-statuses:PUT", PUT_handler);
