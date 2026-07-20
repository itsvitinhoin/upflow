import { Prisma } from "@prisma/client";
import {
  defaultSpaceTaskStatusName,
  sortActiveSpaceTaskStatuses,
  SPACE_TASK_STATUS_FIELD_NAME,
  type SpaceTaskStatus,
} from "@/lib/space-task-status";

type Db = Prisma.TransactionClient;

type SyncInput = {
  workspaceId: string;
  spaceId: string;
  statuses: SpaceTaskStatus[];
  projectIds?: string[];
  renamedValues?: ReadonlyMap<string, string>;
};

function storedOptions(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((option): option is string => typeof option === "string")
    : [];
}

function sameOptions(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Keeps the board field for every project in a Space aligned with the Space
 * workflow. Task values are retained through renames and safely moved to a
 * sensible stage when a stage is removed.
 */
export async function syncSpaceTaskStatusFields(db: Db, input: SyncInput) {
  const statuses = sortActiveSpaceTaskStatuses(input.statuses);
  if (!statuses.length) {
    throw new Error("A Space workflow needs at least one active status");
  }

  const optionNames = statuses.map((status) => status.name);
  const projects = input.projectIds?.length
    ? input.projectIds.map((id) => ({ id }))
    : await db.project.findMany({
        where: { workspace_id: input.workspaceId, space_id: input.spaceId },
        select: { id: true },
      });
  const projectIds = projects.map((project) => project.id);
  if (!projectIds.length) return { projectCount: 0, fieldCount: 0 };

  const [existingFields, allFields] = await Promise.all([
    db.customFieldDefinition.findMany({
      where: {
        project_id: { in: projectIds },
        name: SPACE_TASK_STATUS_FIELD_NAME,
        type: "dropdown",
      },
      select: { id: true, project_id: true, options: true, position: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    db.customFieldDefinition.findMany({
      where: { project_id: { in: projectIds } },
      select: { project_id: true, position: true },
    }),
  ]);

  const fieldByProjectId = new Map<string, (typeof existingFields)[number]>();
  for (const field of existingFields) {
    if (!fieldByProjectId.has(field.project_id)) fieldByProjectId.set(field.project_id, field);
  }

  const maxPositionByProjectId = new Map<string, number>();
  for (const field of allFields) {
    maxPositionByProjectId.set(
      field.project_id,
      Math.max(maxPositionByProjectId.get(field.project_id) ?? -1, field.position),
    );
  }

  for (const projectId of projectIds) {
    const existing = fieldByProjectId.get(projectId);
    if (existing) {
      if (!sameOptions(storedOptions(existing.options), optionNames)) {
        await db.customFieldDefinition.update({
          where: { id: existing.id },
          data: { options: optionNames as Prisma.InputJsonValue },
        });
      }
      continue;
    }

    const field = await db.customFieldDefinition.create({
      data: {
        project_id: projectId,
        name: SPACE_TASK_STATUS_FIELD_NAME,
        type: "dropdown",
        options: optionNames as Prisma.InputJsonValue,
        position: (maxPositionByProjectId.get(projectId) ?? -1) + 1,
      },
      select: { id: true, project_id: true, options: true, position: true },
    });
    fieldByProjectId.set(projectId, field);
  }

  const fieldIds = Array.from(fieldByProjectId.values(), (field) => field.id);
  const [tasks, fieldValues] = await Promise.all([
    db.task.findMany({
      where: { project_id: { in: projectIds } },
      select: { id: true, project_id: true, status: true },
    }),
    db.customFieldValue.findMany({
      where: { definition_id: { in: fieldIds } },
      select: { id: true, task_id: true, value: true },
    }),
  ]);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const seenTaskIds = new Set<string>();
  const repairs: Array<{ id: string; value: string }> = [];

  for (const fieldValue of fieldValues) {
    const task = taskById.get(fieldValue.task_id);
    if (!task) continue;
    seenTaskIds.add(task.id);
    const current = typeof fieldValue.value === "string" ? fieldValue.value : "";
    const renamed = current ? input.renamedValues?.get(current) : undefined;
    const next =
      renamed ??
      (optionNames.includes(current)
        ? current
        : defaultSpaceTaskStatusName(statuses, task.status));
    if (next && next !== current) repairs.push({ id: fieldValue.id, value: next });
  }

  if (repairs.length) {
    await Promise.all(
      repairs.map((repair) =>
        db.customFieldValue.update({
          where: { id: repair.id },
          data: { value: repair.value },
        }),
      ),
    );
  }

  const defaults = tasks.flatMap((task) => {
    if (seenTaskIds.has(task.id)) return [];
    const definition = fieldByProjectId.get(task.project_id);
    const value = defaultSpaceTaskStatusName(statuses, task.status);
    return definition && value
      ? [{ task_id: task.id, definition_id: definition.id, value }]
      : [];
  });
  if (defaults.length) {
    await db.customFieldValue.createMany({ data: defaults });
  }

  return { projectCount: projectIds.length, fieldCount: fieldIds.length };
}
