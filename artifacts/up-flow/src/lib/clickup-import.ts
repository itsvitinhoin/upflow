import { prisma } from "@/lib/prisma";
import {
  getSpaces,
  getFolders,
  getFolderlessLists,
  getListsInFolder,
  getAllTasksForList,
  type ClickUpTask,
  type ClickUpUser,
} from "@/lib/clickup";

export interface ImportProgress {
  stage: string;
  spaces_done: number;
  spaces_total: number;
  folders_done: number;
  folders_total: number;
  lists_done: number;
  lists_total: number;
  tasks_done: number;
  tasks_total: number;
  created: { spaces: number; folders: number; lists: number; tasks: number; users: number };
  updated: { spaces: number; folders: number; lists: number; tasks: number };
  errors: string[];
  done: boolean;
}

function emptyProgress(): ImportProgress {
  return {
    stage: "starting",
    spaces_done: 0,
    spaces_total: 0,
    folders_done: 0,
    folders_total: 0,
    lists_done: 0,
    lists_total: 0,
    tasks_done: 0,
    tasks_total: 0,
    created: { spaces: 0, folders: 0, lists: 0, tasks: 0, users: 0 },
    updated: { spaces: 0, folders: 0, lists: 0, tasks: 0 },
    errors: [],
    done: false,
  };
}

function mapStatus(s?: { status?: string; type?: string }): "todo" | "in_progress" | "done" {
  const type = (s?.type || "").toLowerCase();
  const name = (s?.status || "").toLowerCase();
  if (type === "closed" || type === "done" || name === "closed" || name === "complete" || name === "done")
    return "done";
  if (type === "custom" || name.includes("progress") || name.includes("review") || name.includes("doing"))
    return "in_progress";
  return "todo";
}

function mapPriority(p?: { priority?: string; id?: string } | null): "low" | "medium" | "high" {
  if (!p) return "medium";
  const id = String(p.id ?? "");
  // ClickUp: 1=urgent, 2=high, 3=normal, 4=low
  if (id === "1" || id === "2") return "high";
  if (id === "4") return "low";
  const name = (p.priority || "").toLowerCase();
  if (name === "urgent" || name === "high") return "high";
  if (name === "low") return "low";
  return "medium";
}

function parseTs(v: string | null | undefined): Date | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n);
}

async function resolveAssignee(
  cu: ClickUpUser,
  cache: Map<number, string>,
  progress: ImportProgress,
): Promise<string | null> {
  if (!cu) return null;
  if (cache.has(cu.id)) return cache.get(cu.id) ?? null;
  const email = (cu.email || "").trim().toLowerCase();
  let userId: string | null = null;
  // Match against existing accounts ONLY (read-only) — never use the real
  // ClickUp email for a stub, otherwise Supabase login by that email would
  // silently claim a member account auto-provisioned here.
  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) userId = existing.id;
  }
  if (!userId) {
    // Stub identity for unmatched assignees. The synthetic email is
    // intentionally not deliverable so it cannot be claimed via Supabase auth.
    const stubEmail = `clickup-${cu.id}@import.local`;
    const stub = await prisma.user.upsert({
      where: { email: stubEmail },
      update: {
        name: cu.username || (email ? `${cu.username || cu.id} (${email})` : `ClickUp user ${cu.id}`),
        avatar_url: cu.profilePicture ?? null,
      },
      create: {
        email: stubEmail,
        name: cu.username || (email ? `${cu.username || cu.id} (${email})` : `ClickUp user ${cu.id}`),
        avatar_url: cu.profilePicture ?? null,
        role: "member",
      },
    });
    userId = stub.id;
    progress.created.users++;
  }
  cache.set(cu.id, userId);
  return userId;
}

export interface ImportOptions {
  token: string;
  teamId: string;
  ownerUserId: string;
  workspaceId: string;
  signal?: AbortSignal;
  onProgress?: (p: ImportProgress) => void;
}

export interface PreviewResult {
  spaces: number;
  folders: number;
  lists: number;
  tasks: number;
}

export async function previewImport(opts: {
  token: string;
  teamId: string;
  signal?: AbortSignal;
}): Promise<PreviewResult> {
  const { token, teamId, signal } = opts;
  const result: PreviewResult = { spaces: 0, folders: 0, lists: 0, tasks: 0 };
  const spaces = await getSpaces(teamId, { token, signal });
  result.spaces = spaces.length;
  for (const sp of spaces) {
    const folders = await getFolders(sp.id, { token, signal });
    result.folders += folders.length;
    const folderless = await getFolderlessLists(sp.id, { token, signal });
    result.lists += folderless.length;
    for (const list of folderless) {
      const tasks = await getAllTasksForList(list.id, { token, signal });
      result.tasks += tasks.length;
    }
    for (const f of folders) {
      const lists = await getListsInFolder(f.id, { token, signal });
      result.lists += lists.length;
      for (const list of lists) {
        const tasks = await getAllTasksForList(list.id, { token, signal });
        result.tasks += tasks.length;
      }
    }
  }
  return result;
}

export async function runImport(opts: ImportOptions): Promise<ImportProgress> {
  const { token, teamId, ownerUserId, workspaceId, signal, onProgress } = opts;
  const progress = emptyProgress();
  const userCache = new Map<number, string>();
  const emit = () => onProgress?.({ ...progress });

  try {
    progress.stage = "fetching spaces";
    emit();
    const spaces = await getSpaces(teamId, { token, signal });
    progress.spaces_total = spaces.length;
    emit();

    // Pre-pass: build full topology and totals before writing tasks (gives accurate progress bars)
    type ListInfo = {
      list: import("@/lib/clickup").ClickUpList;
      tasks: ClickUpTask[];
      parentFolderClickup?: string;
      spaceClickup: string;
    };
    type FolderInfo = {
      folder: import("@/lib/clickup").ClickUpFolder;
      spaceClickup: string;
    };
    const allFolders: FolderInfo[] = [];
    const allLists: ListInfo[] = [];

    for (const sp of spaces) {
      progress.stage = `scanning space "${sp.name}"`;
      emit();
      const folders = await getFolders(sp.id, { token, signal });
      progress.folders_total += folders.length;
      for (const f of folders) allFolders.push({ folder: f, spaceClickup: sp.id });
      const folderless = await getFolderlessLists(sp.id, { token, signal });
      for (const list of folderless) {
        const tasks = await getAllTasksForList(list.id, { token, signal });
        allLists.push({ list, tasks, spaceClickup: sp.id });
        progress.lists_total++;
        progress.tasks_total += tasks.length;
        emit();
      }
      for (const f of folders) {
        const lists = await getListsInFolder(f.id, { token, signal });
        for (const list of lists) {
          const tasks = await getAllTasksForList(list.id, { token, signal });
          allLists.push({
            list,
            tasks,
            parentFolderClickup: f.id,
            spaceClickup: sp.id,
          });
          progress.lists_total++;
          progress.tasks_total += tasks.length;
          emit();
        }
      }
    }

    // Write phase: spaces -> folders -> lists -> tasks
    progress.stage = "saving spaces";
    emit();
    const spaceIdByClickup = new Map<string, string>();
    for (let i = 0; i < spaces.length; i++) {
      const sp = spaces[i];
      const existing = await prisma.space.findUnique({ where: { clickup_id: sp.id } });
      if (existing) {
        const updated = await prisma.space.update({
          where: { id: existing.id },
          data: { name: sp.name },
        });
        spaceIdByClickup.set(sp.id, updated.id);
        progress.updated.spaces++;
      } else {
        const last = await prisma.space.findFirst({
          where: { workspace_id: workspaceId },
          orderBy: { position: "desc" },
        });
        const created = await prisma.space.create({
          data: {
            name: sp.name,
            workspace_id: workspaceId,
            owner_id: ownerUserId,
            position: (last?.position ?? -1) + 1 + i,
            clickup_id: sp.id,
          },
        });
        spaceIdByClickup.set(sp.id, created.id);
        progress.created.spaces++;
      }
      progress.spaces_done++;
      emit();
    }

    progress.stage = "saving folders";
    emit();
    const folderIdByClickup = new Map<string, string>();
    for (const fi of allFolders) {
      const spaceId = spaceIdByClickup.get(fi.spaceClickup);
      if (!spaceId) continue;
      const existing = await prisma.folder.findUnique({
        where: { clickup_id: fi.folder.id },
      });
      if (existing) {
        const updated = await prisma.folder.update({
          where: { id: existing.id },
          data: { name: fi.folder.name, space_id: spaceId },
        });
        folderIdByClickup.set(fi.folder.id, updated.id);
        progress.updated.folders++;
      } else {
        const last = await prisma.folder.findFirst({
          where: { space_id: spaceId },
          orderBy: { position: "desc" },
        });
        const created = await prisma.folder.create({
          data: {
            name: fi.folder.name,
            space_id: spaceId,
            workspace_id: workspaceId,
            owner_id: ownerUserId,
            position: (last?.position ?? -1) + 1,
            clickup_id: fi.folder.id,
          },
        });
        folderIdByClickup.set(fi.folder.id, created.id);
        progress.created.folders++;
      }
      progress.folders_done++;
      emit();
    }

    progress.stage = "saving lists & tasks";
    emit();
    const listIdByClickup = new Map<string, string>();
    for (const li of allLists) {
      const spaceId = spaceIdByClickup.get(li.spaceClickup);
      if (!spaceId) continue;
      const folderId = li.parentFolderClickup
        ? folderIdByClickup.get(li.parentFolderClickup) ?? null
        : null;

      const existingProject = await prisma.project.findUnique({
        where: { clickup_id: li.list.id },
      });
      let projectId: string;
      if (existingProject) {
        const updated = await prisma.project.update({
          where: { id: existingProject.id },
          data: {
            name: li.list.name,
            description: li.list.content ?? existingProject.description,
            space_id: spaceId,
            folder_id: folderId,
            due_date: parseTs(li.list.due_date) ?? existingProject.due_date,
          },
        });
        projectId = updated.id;
        progress.updated.lists++;
      } else {
        const created = await prisma.project.create({
          data: {
            name: li.list.name,
            description: li.list.content || null,
            workspace_id: workspaceId,
            owner_id: ownerUserId,
            space_id: spaceId,
            folder_id: folderId,
            due_date: parseTs(li.list.due_date),
            clickup_id: li.list.id,
          },
        });
        projectId = created.id;
        progress.created.lists++;
      }
      listIdByClickup.set(li.list.id, projectId);
      progress.lists_done++;
      emit();

      // Two-pass for tasks within this list: parents first so subtasks can reference them.
      const parents = li.tasks.filter((t) => !t.parent);
      const children = li.tasks.filter((t) => t.parent);
      const taskIdByClickup = new Map<string, string>();

      const writeTask = async (t: ClickUpTask) => {
        const assigneeClickup = t.assignees?.[0];
        const assigneeId = assigneeClickup
          ? await resolveAssignee(assigneeClickup, userCache, progress)
          : null;
        const parentDbId = t.parent ? taskIdByClickup.get(t.parent) ?? null : null;
        const data = {
          title: t.name || "(untitled)",
          description: t.description || t.text_content || null,
          status: mapStatus(t.status),
          priority: mapPriority(t.priority ?? null),
          project_id: projectId,
          assignee_id: assigneeId,
          parent_id: parentDbId,
          due_date: parseTs(t.due_date),
        };
        const existing = await prisma.task.findUnique({ where: { clickup_id: t.id } });
        if (existing) {
          const upd = await prisma.task.update({ where: { id: existing.id }, data });
          taskIdByClickup.set(t.id, upd.id);
          progress.updated.tasks++;
        } else {
          const cre = await prisma.task.create({
            data: { ...data, clickup_id: t.id },
          });
          taskIdByClickup.set(t.id, cre.id);
          progress.created.tasks++;
        }
        progress.tasks_done++;
      };

      for (const t of parents) {
        try {
          await writeTask(t);
        } catch (e) {
          progress.errors.push(`Task ${t.id}: ${(e as Error).message}`);
        }
      }
      // Iteratively drain subtasks: a child whose parent is itself a subtask
      // can only be written after its parent is, so loop until no progress.
      let remaining = [...children];
      while (remaining.length > 0) {
        const next: ClickUpTask[] = [];
        let wroteSomething = false;
        for (const t of remaining) {
          let parentResolved = false;
          if (t.parent) {
            if (taskIdByClickup.has(t.parent)) {
              parentResolved = true;
            } else {
              const dbParent = await prisma.task.findUnique({
                where: { clickup_id: t.parent },
              });
              if (dbParent) {
                taskIdByClickup.set(t.parent, dbParent.id);
                parentResolved = true;
              }
            }
          }
          if (!parentResolved) {
            next.push(t);
            continue;
          }
          try {
            await writeTask(t);
            wroteSomething = true;
          } catch (e) {
            progress.errors.push(`Task ${t.id}: ${(e as Error).message}`);
          }
        }
        if (!wroteSomething) {
          // Parents are external to this import — write with parent_id=null
          // so the task isn't silently dropped, and record an error.
          for (const t of next) {
            progress.errors.push(
              `Task ${t.id}: parent ${t.parent ?? "?"} not found, imported without parent`,
            );
            try {
              const orphan = { ...t, parent: null } as ClickUpTask;
              await writeTask(orphan);
            } catch (e) {
              progress.errors.push(`Task ${t.id}: ${(e as Error).message}`);
            }
          }
          break;
        }
        remaining = next;
      }
      emit();
    }

    progress.stage = "complete";
    progress.done = true;
    emit();
    return progress;
  } catch (e) {
    console.error("[clickup-import] runImport error:", e);
    progress.errors.push((e as Error).message || String(e));
    progress.stage = "failed";
    progress.done = true;
    emit();
    return progress;
  }
}
