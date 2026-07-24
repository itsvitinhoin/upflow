import { Prisma, type ProjectKind } from "@prisma/client";
import { getDescendantFolderIds } from "@/lib/folder-tree";

type Tx = Prisma.TransactionClient;

interface DuplicateProjectInput {
  sourceProjectId: string;
  actorId: string;
  folderId?: string | null;
}

export interface DuplicateProjectResult {
  project: {
    id: string;
    name: string;
    workspace_id: string;
    space_id: string | null;
    folder_id: string | null;
    company_id: string | null;
  };
  copied: {
    custom_fields: number;
    workflow_statuses: number;
    project_members: number;
    tasks: number;
  };
}

export interface DuplicateFolderResult {
  folder: {
    id: string;
    name: string;
    workspace_id: string;
    space_id: string;
    parent_id: string | null;
  };
  copied: {
    folders: number;
    lists: number;
    custom_fields: number;
    workflow_statuses: number;
    project_members: number;
    tasks: number;
  };
}

function copyName(baseName: string, existingNames: string[]) {
  const root = `Copy of ${baseName}`;
  const names = new Set(existingNames);
  if (!names.has(root)) return root;

  let copyNumber = 2;
  while (names.has(`${root} (${copyNumber})`)) copyNumber += 1;
  return `${root} (${copyNumber})`;
}

async function nextProjectCopyName(
  tx: Tx,
  source: { name: string; workspace_id: string; space_id: string | null },
  folderId: string | null,
) {
  const root = `Copy of ${source.name}`;
  const existing = await tx.project.findMany({
    where: {
      workspace_id: source.workspace_id,
      space_id: source.space_id,
      folder_id: folderId,
      name: { startsWith: root },
    },
    select: { name: true },
  });
  return copyName(source.name, existing.map((project) => project.name));
}

async function nextFolderCopyName(
  tx: Tx,
  source: { name: string; workspace_id: string; space_id: string; parent_id: string | null },
) {
  const root = `Copy of ${source.name}`;
  const existing = await tx.folder.findMany({
    where: {
      workspace_id: source.workspace_id,
      space_id: source.space_id,
      parent_id: source.parent_id,
      name: { startsWith: root },
    },
    select: { name: true },
  });
  return copyName(source.name, existing.map((folder) => folder.name));
}

function projectKindForDuplicate(kind: ProjectKind, companyId: string | null): ProjectKind {
  if (kind === "onboarding") return companyId ? "client" : "internal";
  return kind;
}

/**
 * Copies reusable list structure and work while intentionally omitting live
 * history such as comments, calendar events, timers, automation, and onboarding.
 */
export async function duplicateProject(
  tx: Tx,
  { sourceProjectId, actorId, folderId }: DuplicateProjectInput,
): Promise<DuplicateProjectResult | null> {
  const source = await tx.project.findUnique({
    where: { id: sourceProjectId },
    include: {
      custom_fields: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      workflow_statuses: { orderBy: [{ stage_order: "asc" }, { id: "asc" }] },
      project_members: { select: { user_id: true, role: true } },
      tasks: {
        orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
        include: {
          custom_field_values: {
            select: { definition_id: true, value: true },
          },
        },
      },
    },
  });
  if (!source) return null;

  const targetFolderId = folderId === undefined ? source.folder_id : folderId;
  const project = await tx.project.create({
    data: {
      name: await nextProjectCopyName(tx, source, targetFolderId),
      description: source.description,
      status: "active",
      kind: projectKindForDuplicate(source.kind, source.company_id),
      workspace_id: source.workspace_id,
      owner_id: actorId,
      space_id: source.space_id,
      folder_id: targetFolderId,
      company_id: source.company_id,
      onboarding_enabled: false,
      sidebar_hidden: false,
      due_date: source.due_date,
      initial_notes: source.initial_notes,
      responsible_salesperson_id: source.responsible_salesperson_id,
    },
    select: {
      id: true,
      name: true,
      workspace_id: true,
      space_id: true,
      folder_id: true,
      company_id: true,
    },
  });

  const fieldIdBySourceId = new Map<string, string>();
  for (const field of source.custom_fields) {
    const duplicate = await tx.customFieldDefinition.create({
      data: {
        project_id: project.id,
        name: field.name,
        type: field.type,
        options:
          field.options === null
            ? Prisma.JsonNull
            : (field.options as Prisma.InputJsonValue),
        position: field.position,
      },
      select: { id: true },
    });
    fieldIdBySourceId.set(field.id, duplicate.id);
  }

  if (source.workflow_statuses.length > 0) {
    await tx.workflowStatus.createMany({
      data: source.workflow_statuses.map((status) => ({
        workspace_id: status.workspace_id,
        project_id: project.id,
        space_id: status.space_id,
        key: status.key,
        name: status.name,
        category: status.category,
        stage_order: status.stage_order,
        color: status.color,
        terminal: status.terminal,
        active: status.active,
      })),
    });
  }

  if (source.project_members.length > 0) {
    await tx.projectMember.createMany({
      data: source.project_members.map((member) => ({
        project_id: project.id,
        user_id: member.user_id,
        role: member.role,
      })),
      skipDuplicates: true,
    });
  }

  const taskIdBySourceId = new Map<string, string>();
  const pendingTasks = [...source.tasks];
  while (pendingTasks.length > 0) {
    const readyTasks = pendingTasks.filter(
      (task) => !task.parent_id || taskIdBySourceId.has(task.parent_id),
    );
    const tasksToCopy = readyTasks.length > 0 ? readyTasks : pendingTasks;

    for (const task of tasksToCopy) {
      const duplicate = await tx.task.create({
        data: {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          project_id: project.id,
          assignee_id: task.assignee_id,
          parent_id: task.parent_id ? taskIdBySourceId.get(task.parent_id) ?? null : null,
          company_id: task.company_id ?? source.company_id,
          cover_image_url: task.cover_image_url,
          due_date: task.due_date,
          position: task.position,
        },
        select: { id: true },
      });
      taskIdBySourceId.set(task.id, duplicate.id);
    }

    const copiedIds = new Set(tasksToCopy.map((task) => task.id));
    for (let index = pendingTasks.length - 1; index >= 0; index -= 1) {
      if (copiedIds.has(pendingTasks[index].id)) pendingTasks.splice(index, 1);
    }
  }

  const customFieldValues = source.tasks.flatMap((task) => {
    const taskId = taskIdBySourceId.get(task.id);
    if (!taskId) return [];
    return task.custom_field_values.flatMap((value) => {
      const definitionId = fieldIdBySourceId.get(value.definition_id);
      if (!definitionId) return [];
      return [{
        task_id: taskId,
        definition_id: definitionId,
        value:
          value.value === null
            ? Prisma.JsonNull
            : (value.value as Prisma.InputJsonValue),
      }];
    });
  });
  if (customFieldValues.length > 0) {
    await tx.customFieldValue.createMany({ data: customFieldValues });
  }

  return {
    project,
    copied: {
      custom_fields: source.custom_fields.length,
      workflow_statuses: source.workflow_statuses.length,
      project_members: source.project_members.length,
      tasks: source.tasks.length,
    },
  };
}

export async function duplicateFolder(
  tx: Tx,
  { sourceFolderId, actorId }: { sourceFolderId: string; actorId: string },
): Promise<DuplicateFolderResult | null> {
  const source = await tx.folder.findUnique({ where: { id: sourceFolderId } });
  if (!source) return null;

  const allFolders = await tx.folder.findMany({
    where: { workspace_id: source.workspace_id, space_id: source.space_id },
    orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
  });
  const sourceFolderIds = [
    source.id,
    ...getDescendantFolderIds(allFolders, source.id),
  ];
  const sourceFolderIdSet = new Set(sourceFolderIds);
  const sourceFolders = allFolders.filter((folder) => sourceFolderIdSet.has(folder.id));
  const sourceProjects = await tx.project.findMany({
    where: {
      workspace_id: source.workspace_id,
      folder_id: { in: sourceFolderIds },
    },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: { id: true, folder_id: true },
  });

  const lastSibling = await tx.folder.findFirst({
    where: {
      workspace_id: source.workspace_id,
      space_id: source.space_id,
      parent_id: source.parent_id,
    },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const folderIdBySourceId = new Map<string, string>();
  const copied = {
    folders: 0,
    lists: 0,
    custom_fields: 0,
    workflow_statuses: 0,
    project_members: 0,
    tasks: 0,
  };

  const cloneFolder = async (sourceFolderId: string, parentId: string | null) => {
    const sourceFolder = sourceFolders.find((folder) => folder.id === sourceFolderId);
    if (!sourceFolder) return;

    const root = sourceFolder.id === source.id;
    const folder = await tx.folder.create({
      data: {
        name: root ? await nextFolderCopyName(tx, sourceFolder) : sourceFolder.name,
        icon: sourceFolder.icon,
        space_id: sourceFolder.space_id,
        workspace_id: sourceFolder.workspace_id,
        owner_id: actorId,
        parent_id: parentId,
        position: root ? (lastSibling?.position ?? -1) + 1 : sourceFolder.position,
        sidebar_hidden: false,
      },
      select: {
        id: true,
        name: true,
        workspace_id: true,
        space_id: true,
        parent_id: true,
      },
    });
    folderIdBySourceId.set(sourceFolder.id, folder.id);
    copied.folders += 1;

    for (const project of sourceProjects.filter(
      (candidate) => candidate.folder_id === sourceFolder.id,
    )) {
      const duplicate = await duplicateProject(tx, {
        sourceProjectId: project.id,
        actorId,
        folderId: folder.id,
      });
      if (!duplicate) continue;
      copied.lists += 1;
      copied.custom_fields += duplicate.copied.custom_fields;
      copied.workflow_statuses += duplicate.copied.workflow_statuses;
      copied.project_members += duplicate.copied.project_members;
      copied.tasks += duplicate.copied.tasks;
    }

    for (const child of sourceFolders.filter(
      (candidate) => candidate.parent_id === sourceFolder.id,
    )) {
      await cloneFolder(child.id, folder.id);
    }

    return folder;
  };

  const folder = await cloneFolder(source.id, source.parent_id);
  if (!folder) return null;

  return { folder, copied };
}
