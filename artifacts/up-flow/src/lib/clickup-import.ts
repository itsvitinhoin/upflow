import { Prisma, type TaskPriority, type TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clickupFolderlessLists, clickupFolders, clickupLists, clickupSpaces, clickupTask, clickupTasks, type ClickUpList, type ClickUpTask } from "@/lib/clickup";

export function mapStatus(value: string | null | undefined): TaskStatus { const v = value?.toLowerCase() ?? ""; return v.includes("complete") || v === "done" ? "done" : v.includes("progress") || v.includes("doing") ? "in_progress" : "todo"; }
export function mapPriority(value: string | number | null | undefined): TaskPriority { const v = String(value ?? "").toLowerCase(); return v === "urgent" || v === "high" || v === "1" || v === "2" ? "high" : v === "low" || v === "4" ? "low" : "medium"; }
export function mapDate(value: string | null | undefined) { if (!value) return null; const date = new Date(Number(value)); return Number.isNaN(date.valueOf()) ? null : date; }

export async function clickupHierarchy(workspaceId: string) {
  const allowed = new Set(["criativos & design", "marketing b2b - up agency"]);
  const spaces = (await clickupSpaces(workspaceId)).spaces.filter((item) => allowed.has(item.name.trim().toLowerCase()));
  const result: Array<{ space: { id: string; name: string }; folders: Array<{ id: string; name: string; lists: ClickUpList[] }>; lists: ClickUpList[] }> = [];
  for (const sourceSpace of spaces) {
    const folders = (await clickupFolders(sourceSpace.id)).folders;
    const mapped = [];
    for (const sourceFolder of folders) mapped.push({ id: sourceFolder.id, name: sourceFolder.name, lists: (await clickupLists(sourceFolder.id)).lists });
    result.push({ space: { id: sourceSpace.id, name: sourceSpace.name }, folders: mapped, lists: (await clickupFolderlessLists(sourceSpace.id)).lists });
  }
  return result;
}

export async function previewClickup(sourceWorkspaceId: string, listIds: string[]) {
  let tasks = 0; const users = new Set<string>();
  for (const listId of listIds) for (let page = 0;; page += 1) { const response = await clickupTasks(listId, page); for (const item of response.tasks) { if (!item.archived) { tasks += 1; item.assignees?.forEach((user) => user.email && users.add(user.email)); } } if (response.last_page !== false || response.tasks.length < 100) break; }
  return { lists: listIds.length, tasks, assignee_emails: [...users].sort() };
}

type Selected = { space_id: string; space_name?: string; folder_id?: string; folder_name?: string; list_id: string; list_name?: string };
export async function runClickupBatch(jobId: string, actorId: string, batchSize = 20) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "cancelled" || job.status === "completed") return job;
  const selected = Array.isArray(job.selected_source_ids) ? job.selected_source_ids as unknown as Selected[] : [];
  const sourceLists = selected.slice(job.cursor, job.cursor + batchSize);
  if (!sourceLists.length) return prisma.importJob.update({ where: { id: jobId }, data: { status: "completed", completed_at: new Date() } });
  const workspace = job.workspace_id;
  const members = await prisma.workspaceMember.findMany({ where: { workspace_id: workspace, status: "active" }, include: { user: { select: { id: true, email: true } } } });
  const byEmail = new Map(members.map((member) => [member.user.email.toLowerCase(), member.user.id]));
  let imported = 0; let failed = 0;
  for (const source of sourceLists) {
    try {
      const existing = await prisma.importMapping.findUnique({ where: { source_workspace_id_entity_type_source_id: { source_workspace_id: job.source_workspace_id, entity_type: "list", source_id: source.list_id } } });
      let projectId = existing?.target_id ?? null;
      const space = await prisma.importMapping.findUnique({ where: { source_workspace_id_entity_type_source_id: { source_workspace_id: job.source_workspace_id, entity_type: "space", source_id: source.space_id } } });
      const targetSpace = space?.target_id ?? (await prisma.space.create({ data: { name: source.space_name ?? `ClickUp: ${source.space_id}`, workspace_id: workspace, owner_id: actorId } })).id;
      if (!space) await prisma.importMapping.create({ data: { job_id: job.id, workspace_id: workspace, source_workspace_id: job.source_workspace_id, entity_type: "space", source_id: source.space_id, target_id: targetSpace } });
      let folderId: string | null = null;
      if (source.folder_id) { const mappedFolder = await prisma.importMapping.findUnique({ where: { source_workspace_id_entity_type_source_id: { source_workspace_id: job.source_workspace_id, entity_type: "folder", source_id: source.folder_id } } }); folderId = mappedFolder?.target_id ?? (await prisma.folder.create({ data: { name: source.folder_name ?? `ClickUp folder ${source.folder_id}`, workspace_id: workspace, space_id: targetSpace, owner_id: actorId } })).id; if (!mappedFolder) await prisma.importMapping.create({ data: { job_id: job.id, workspace_id: workspace, source_workspace_id: job.source_workspace_id, entity_type: "folder", source_id: source.folder_id, target_id: folderId } }); }
      if (!projectId) { const created = await prisma.project.create({ data: { name: source.list_name ?? `ClickUp list ${source.list_id}`, workspace_id: workspace, owner_id: actorId, space_id: targetSpace, folder_id: folderId } }); projectId = created.id; await prisma.importMapping.create({ data: { job_id: job.id, workspace_id: workspace, source_workspace_id: job.source_workspace_id, entity_type: "list", source_id: source.list_id, target_id: projectId } }); }
      for (let page = 0;; page += 1) { const response = await clickupTasks(source.list_id, page); for (const raw of response.tasks) { if (raw.archived) continue; await importTask(job.id, workspace, projectId, raw, byEmail); imported += 1; } if (response.last_page !== false || response.tasks.length < 100) break; }
    } catch { failed += 1; }
  }
  return prisma.importJob.update({ where: { id: job.id }, data: { cursor: { increment: sourceLists.length }, imported: { increment: imported }, failed: { increment: failed }, status: "running" } });
}

async function importTask(jobId: string, workspaceId: string, projectId: string, raw: ClickUpTask, byEmail: Map<string, string>, parentId?: string) {
  const sourceWorkspaceId = (await prisma.importJob.findUniqueOrThrow({ where: { id: jobId }, select: { source_workspace_id: true } })).source_workspace_id;
  const mapped = await prisma.importMapping.findUnique({ where: { source_workspace_id_entity_type_source_id: { source_workspace_id: sourceWorkspaceId, entity_type: "task", source_id: raw.id } } });
  if (mapped?.target_id) return mapped.target_id;
  const assignee = raw.assignees?.find((user) => user.email)?.email?.toLowerCase();
  const task = await prisma.task.create({ data: { title: raw.name, description: raw.description || raw.text_content || null, project_id: projectId, status: mapStatus(raw.status?.status), priority: mapPriority(raw.priority?.priority), due_date: mapDate(raw.due_date), position: Number(raw.orderindex) || 0, assignee_id: assignee ? byEmail.get(assignee) ?? null : null, parent_id: parentId ?? null } });
  await prisma.importMapping.create({ data: { job_id: jobId, workspace_id: workspaceId, source_workspace_id: sourceWorkspaceId, entity_type: "task", source_id: raw.id, target_id: task.id } });
  for (const child of raw.subtasks ?? []) { const detail = await clickupTask(child.id); await importTask(jobId, workspaceId, projectId, detail, byEmail, task.id); }
  return task.id;
}
