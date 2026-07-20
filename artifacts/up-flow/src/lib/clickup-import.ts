import { type TaskPriority, type TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  clickupFolderlessLists,
  clickupFolders,
  clickupLists,
  clickupSpaces,
  clickupTask,
  clickupTasks,
  type ClickUpList,
  type ClickUpTask,
} from "@/lib/clickup";

type Selected = {
  space_id: string;
  space_name?: string;
  folder_id?: string;
  folder_name?: string;
  list_id: string;
  list_name?: string;
};

type ImportFailure = {
  list_id: string;
  list_name?: string;
  error: string;
};

type StatusSyncReport = {
  active: boolean;
  updated: number;
  failed: number;
  failures: ImportFailure[];
  completed_at?: string;
};

type ImportReport = {
  failures: ImportFailure[];
  retry_count: number;
  status_sync?: StatusSyncReport;
};

export type ImportedClickupSpace = {
  id: string;
  name: string;
  selected_lists: number;
};

const MAX_REPORTED_FAILURES = 50;
const MIN_INT = -2_147_483_648;
const MAX_INT = 2_147_483_647;
const COMPLETED_STATUS_MARKERS = [
  "complete",
  "done",
  "conclu",
  "finaliz",
  "entreg",
  "publicad",
  "published",
  "approved",
  "aprovad",
  "fechad",
  "encerr",
  "feito",
  "feita",
  "closed",
  "cancel",
];
const IN_PROGRESS_STATUS_MARKERS = [
  "progress",
  "doing",
  "andamento",
  "produ",
  "revis",
  "review",
  "approval",
  "aprov",
  "aguard",
  "await",
  "waiting",
  "blocked",
  "bloque",
  "agend",
];

export function mapStatus(value: string | null | undefined): TaskStatus {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (COMPLETED_STATUS_MARKERS.some((marker) => normalized.includes(marker))) {
    return "done";
  }
  if (IN_PROGRESS_STATUS_MARKERS.some((marker) => normalized.includes(marker))) {
    return "in_progress";
  }
  return "todo";
}

export function mapPriority(
  value: string | number | null | undefined,
): TaskPriority {
  const normalized = String(value ?? "").toLowerCase();
  if (
    normalized === "urgent" ||
    normalized === "high" ||
    normalized === "1" ||
    normalized === "2"
  ) {
    return "high";
  }
  return normalized === "low" || normalized === "4" ? "low" : "medium";
}

export function mapDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(Number(value));
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function mapPosition(value: string | number | null | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(MIN_INT, Math.min(MAX_INT, Math.round(numeric)));
}

export async function clickupHierarchy(workspaceId: string) {
  const allowed = new Set(["criativos & design", "marketing b2b - up agency"]);
  const spaces = (await clickupSpaces(workspaceId)).spaces.filter((item) =>
    allowed.has(item.name.trim().toLowerCase()),
  );
  const result: Array<{
    space: { id: string; name: string };
    folders: Array<{ id: string; name: string; lists: ClickUpList[] }>;
    lists: ClickUpList[];
  }> = [];

  for (const sourceSpace of spaces) {
    const folders = (await clickupFolders(sourceSpace.id)).folders;
    const mapped = [];
    for (const sourceFolder of folders) {
      mapped.push({
        id: sourceFolder.id,
        name: sourceFolder.name,
        lists: (await clickupLists(sourceFolder.id)).lists,
      });
    }
    result.push({
      space: { id: sourceSpace.id, name: sourceSpace.name },
      folders: mapped,
      lists: (await clickupFolderlessLists(sourceSpace.id)).lists,
    });
  }
  return result;
}

export async function previewClickup(_sourceWorkspaceId: string, listIds: string[]) {
  let tasks = 0;
  const users = new Set<string>();

  for (const listId of listIds) {
    for (let page = 0; ; page += 1) {
      const response = await clickupTasks(listId, page);
      for (const item of response.tasks) {
        if (item.archived) continue;
        tasks += 1;
        item.assignees.forEach((user) => {
          if (user.email) users.add(user.email);
        });
      }
      if (response.last_page !== false || response.tasks.length < 100) break;
    }
  }

  return { lists: listIds.length, tasks, assignee_emails: [...users].sort() };
}

function selectedLists(value: unknown): Selected[] {
  if (!Array.isArray(value)) return [];
  const result: Selected[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.space_id !== "string" ||
      typeof candidate.list_id !== "string"
    ) {
      continue;
    }
    result.push({
      space_id: candidate.space_id,
      list_id: candidate.list_id,
      ...(typeof candidate.space_name === "string" && {
        space_name: candidate.space_name,
      }),
      ...(typeof candidate.folder_id === "string" && {
        folder_id: candidate.folder_id,
      }),
      ...(typeof candidate.folder_name === "string" && {
        folder_name: candidate.folder_name,
      }),
      ...(typeof candidate.list_name === "string" && {
        list_name: candidate.list_name,
      }),
    });
  }
  return result;
}

export async function getImportedClickupSpaces(job: {
  workspace_id: string;
  source_workspace_id: string;
  selected_source_ids: unknown;
}): Promise<ImportedClickupSpace[]> {
  const selected = selectedLists(job.selected_source_ids);
  const sourceSpaces = new Map<string, number>();
  for (const source of selected) {
    sourceSpaces.set(
      source.space_id,
      (sourceSpaces.get(source.space_id) ?? 0) + 1,
    );
  }

  const sourceIds = [...sourceSpaces.keys()];
  if (!sourceIds.length) return [];

  const mappings = await prisma.importMapping.findMany({
    where: {
      workspace_id: job.workspace_id,
      source_workspace_id: job.source_workspace_id,
      entity_type: "space",
      source_id: { in: sourceIds },
      target_id: { not: null },
    },
    select: { source_id: true, target_id: true },
  });
  const targetIdBySource = new Map(
    mappings.flatMap((mapping) =>
      mapping.target_id ? [[mapping.source_id, mapping.target_id] as const] : [],
    ),
  );
  const spaces = await prisma.space.findMany({
    where: {
      id: { in: [...targetIdBySource.values()] },
      workspace_id: job.workspace_id,
    },
    select: { id: true, name: true },
  });
  const spaceById = new Map(spaces.map((space) => [space.id, space]));

  return sourceIds.flatMap((sourceId) => {
    const targetId = targetIdBySource.get(sourceId);
    const space = targetId ? spaceById.get(targetId) : null;
    return space
      ? [{ ...space, selected_lists: sourceSpaces.get(sourceId) ?? 0 }]
      : [];
  });
}

function importFailures(value: unknown): ImportFailure[] {
  const failures: ImportFailure[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const candidate = item as Record<string, unknown>;
      if (
        typeof candidate.list_id === "string" &&
        typeof candidate.error === "string"
      ) {
        failures.push({
          list_id: candidate.list_id,
          error: candidate.error,
          ...(typeof candidate.list_name === "string" && {
            list_name: candidate.list_name,
          }),
        });
      }
    }
  }
  return failures.slice(-MAX_REPORTED_FAILURES);
}

function integerValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function statusSyncReport(value: unknown): StatusSyncReport | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  return {
    active: candidate.active === true,
    updated: integerValue(candidate.updated),
    failed: integerValue(candidate.failed),
    failures: importFailures(candidate.failures),
    ...(typeof candidate.completed_at === "string" && {
      completed_at: candidate.completed_at,
    }),
  };
}

function importReport(value: unknown): ImportReport {
  const report =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const sync = statusSyncReport(report.status_sync);
  return {
    failures: importFailures(report.failures),
    retry_count: integerValue(report.retry_count),
    ...(sync && { status_sync: sync }),
  };
}

export function beginClickupStatusSync(value: unknown): ImportReport {
  const report = importReport(value);
  return {
    ...report,
    status_sync: {
      active: true,
      updated: 0,
      failed: 0,
      failures: [],
    },
  };
}

export function isClickupStatusSyncActive(value: unknown): boolean {
  return importReport(value).status_sync?.active === true;
}

function summarizeImportError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unexpected import failure";
  return message
    .replace(/(authorization|token|secret|password)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 500);
}

async function recordListFailure(
  job: { id: string; workspace_id: string; source_workspace_id: string },
  source: Selected,
  error: string,
) {
  const where = {
    source_workspace_id_entity_type_source_id: {
      source_workspace_id: job.source_workspace_id,
      entity_type: "list",
      source_id: source.list_id,
    },
  };
  await prisma.importMapping.upsert({
    where,
    create: {
      job_id: job.id,
      workspace_id: job.workspace_id,
      source_workspace_id: job.source_workspace_id,
      entity_type: "list",
      source_id: source.list_id,
      status: "failed",
      error,
    },
    update: { status: "failed", error },
  });
}

export async function runClickupBatch(
  jobId: string,
  actorId: string,
  batchSize = 20,
) {
  let job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "cancelled" || job.status === "completed") return job;

  const selected = selectedLists(job.selected_source_ids);
  let report = importReport(job.report);
  if (!selected.length) {
    return prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completed_at: new Date(),
        report: {
          ...report,
          failures: [
            ...report.failures,
            { list_id: "unknown", error: "No selected ClickUp lists were stored for this job." },
          ].slice(-MAX_REPORTED_FAILURES),
        },
      },
    });
  }

  // A terminal failed job retries its original scope. Existing mappings make
  // this safe after an interrupted or partially completed import.
  if (job.cursor >= selected.length && job.failed > 0) {
    report = { failures: [], retry_count: report.retry_count + 1 };
    job = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        cursor: 0,
        total: selected.length,
        failed: 0,
        status: "running",
        completed_at: null,
        report,
      },
    });
  }

  const sourceLists = selected.slice(job.cursor, job.cursor + batchSize);
  if (!sourceLists.length) {
    return prisma.importJob.update({
      where: { id: job.id },
      data: {
        total: selected.length,
        status: job.failed > 0 ? "failed" : "completed",
        completed_at: new Date(),
      },
    });
  }

  const members = await prisma.workspaceMember.findMany({
    where: { workspace_id: job.workspace_id, status: "active" },
    include: { user: { select: { id: true, email: true } } },
  });
  const byEmail = new Map(
    members.map((member) => [member.user.email.toLowerCase(), member.user.id]),
  );

  let imported = 0;
  let failed = 0;
  const failures: ImportFailure[] = [];

  for (const source of sourceLists) {
    try {
      const mappingWhere = {
        source_workspace_id_entity_type_source_id: {
          source_workspace_id: job.source_workspace_id,
          entity_type: "list",
          source_id: source.list_id,
        },
      };
      const listMapping = await prisma.importMapping.findUnique({
        where: mappingWhere,
      });
      let projectId = listMapping?.target_id ?? null;

      const spaceWhere = {
        source_workspace_id_entity_type_source_id: {
          source_workspace_id: job.source_workspace_id,
          entity_type: "space",
          source_id: source.space_id,
        },
      };
      const spaceMapping = await prisma.importMapping.findUnique({
        where: spaceWhere,
      });
      const targetSpace =
        spaceMapping?.target_id ??
        (
          await prisma.space.create({
            data: {
              name: source.space_name ?? `ClickUp: ${source.space_id}`,
              workspace_id: job.workspace_id,
              owner_id: actorId,
            },
          })
        ).id;
      if (!spaceMapping) {
        await prisma.importMapping.create({
          data: {
            job_id: job.id,
            workspace_id: job.workspace_id,
            source_workspace_id: job.source_workspace_id,
            entity_type: "space",
            source_id: source.space_id,
            target_id: targetSpace,
          },
        });
      }

      let folderId: string | null = null;
      if (source.folder_id) {
        const folderWhere = {
          source_workspace_id_entity_type_source_id: {
            source_workspace_id: job.source_workspace_id,
            entity_type: "folder",
            source_id: source.folder_id,
          },
        };
        const mappedFolder = await prisma.importMapping.findUnique({
          where: folderWhere,
        });
        folderId =
          mappedFolder?.target_id ??
          (
            await prisma.folder.create({
              data: {
                name: source.folder_name ?? `ClickUp folder ${source.folder_id}`,
                workspace_id: job.workspace_id,
                space_id: targetSpace,
                owner_id: actorId,
              },
            })
          ).id;
        if (!mappedFolder) {
          await prisma.importMapping.create({
            data: {
              job_id: job.id,
              workspace_id: job.workspace_id,
              source_workspace_id: job.source_workspace_id,
              entity_type: "folder",
              source_id: source.folder_id,
              target_id: folderId,
            },
          });
        }
      }

      if (!projectId) {
        projectId = (
          await prisma.project.create({
            data: {
              name: source.list_name ?? `ClickUp list ${source.list_id}`,
              workspace_id: job.workspace_id,
              owner_id: actorId,
              space_id: targetSpace,
              folder_id: folderId,
            },
          })
        ).id;
        if (listMapping) {
          await prisma.importMapping.update({
            where: mappingWhere,
            data: { target_id: projectId, status: "importing", error: null },
          });
        } else {
          await prisma.importMapping.create({
            data: {
              job_id: job.id,
              workspace_id: job.workspace_id,
              source_workspace_id: job.source_workspace_id,
              entity_type: "list",
              source_id: source.list_id,
              target_id: projectId,
              status: "importing",
            },
          });
        }
      }

      for (let page = 0; ; page += 1) {
        const response = await clickupTasks(source.list_id, page);
        for (const raw of response.tasks) {
          if (raw.archived) continue;
          await importTask(
            job.id,
            job.workspace_id,
            job.source_workspace_id,
            projectId,
            raw,
            byEmail,
          );
          imported += 1;
        }
        if (response.last_page !== false || response.tasks.length < 100) break;
      }

      await prisma.importMapping.update({
        where: mappingWhere,
        data: { status: "imported", error: null },
      });
    } catch (error) {
      failed += 1;
      const summary = summarizeImportError(error);
      failures.push({
        list_id: source.list_id,
        ...(source.list_name && { list_name: source.list_name }),
        error: summary,
      });
      try {
        await recordListFailure(job, source, summary);
      } catch {
        // The job-level report below still records the source failure.
      }
    }
  }

  const cursor = job.cursor + sourceLists.length;
  const complete = cursor >= selected.length;
  const totalFailures = job.failed + failed;
  return prisma.importJob.update({
    where: { id: job.id },
    data: {
      cursor,
      total: selected.length,
      imported: { increment: imported },
      failed: { increment: failed },
      status: complete ? (totalFailures > 0 ? "failed" : "completed") : "running",
      completed_at: complete ? new Date() : null,
      report: {
        ...report,
        failures: [...report.failures, ...failures].slice(-MAX_REPORTED_FAILURES),
      },
    },
  });
}

async function syncImportedTaskStatus(
  workspaceId: string,
  sourceWorkspaceId: string,
  raw: ClickUpTask,
  seen: Set<string>,
): Promise<number> {
  if (seen.has(raw.id)) return 0;
  seen.add(raw.id);

  const mapped = await prisma.importMapping.findFirst({
    where: {
      workspace_id: workspaceId,
      source_workspace_id: sourceWorkspaceId,
      entity_type: "task",
      source_id: raw.id,
      target_id: { not: null },
    },
    select: { target_id: true },
  });
  const updated = mapped?.target_id
    ? await prisma.task.updateMany({
        where: {
          id: mapped.target_id,
          project: { workspace_id: workspaceId },
        },
        data: { status: mapStatus(raw.status?.status) },
      })
    : { count: 0 };

  let synced = updated.count;
  for (const child of raw.subtasks) {
    const detail = await clickupTask(child.id);
    if (!detail.archived) {
      synced += await syncImportedTaskStatus(
        workspaceId,
        sourceWorkspaceId,
        detail,
        seen,
      );
    }
  }
  return synced;
}

export async function runClickupStatusSync(jobId: string, batchSize = 20) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "cancelled") return job;

  const report = importReport(job.report);
  const sync = report.status_sync;
  if (!sync || !sync.active) return job;

  const selected = selectedLists(job.selected_source_ids);
  const finish = async (failure?: ImportFailure) => {
    const completedAt = new Date();
    return prisma.importJob.update({
      where: { id: job.id },
      data: {
        total: selected.length,
        status: "completed",
        completed_at: completedAt,
        report: {
          ...report,
          status_sync: {
            ...sync,
            active: false,
            failed: sync.failed + (failure ? 1 : 0),
            failures: failure
              ? [...sync.failures, failure].slice(-MAX_REPORTED_FAILURES)
              : sync.failures,
            completed_at: completedAt.toISOString(),
          },
        },
      },
    });
  };

  if (!selected.length) {
    return finish({
      list_id: "unknown",
      error: "No selected ClickUp lists were stored for this job.",
    });
  }

  const sourceLists = selected.slice(job.cursor, job.cursor + batchSize);
  if (!sourceLists.length) return finish();

  const seen = new Set<string>();
  let updated = 0;
  let failed = 0;
  const failures: ImportFailure[] = [];

  for (const source of sourceLists) {
    try {
      for (let page = 0; ; page += 1) {
        const response = await clickupTasks(source.list_id, page);
        for (const raw of response.tasks) {
          if (raw.archived) continue;
          updated += await syncImportedTaskStatus(
            job.workspace_id,
            job.source_workspace_id,
            raw,
            seen,
          );
        }
        if (response.last_page !== false || response.tasks.length < 100) break;
      }
    } catch (error) {
      failed += 1;
      failures.push({
        list_id: source.list_id,
        ...(source.list_name && { list_name: source.list_name }),
        error: summarizeImportError(error),
      });
    }
  }

  const cursor = job.cursor + sourceLists.length;
  const complete = cursor >= selected.length;
  const completedAt = complete ? new Date() : null;
  return prisma.importJob.update({
    where: { id: job.id },
    data: {
      cursor,
      total: selected.length,
      status: complete ? "completed" : "running",
      completed_at: completedAt,
      report: {
        ...report,
        status_sync: {
          ...sync,
          active: !complete,
          updated: sync.updated + updated,
          failed: sync.failed + failed,
          failures: [...sync.failures, ...failures].slice(-MAX_REPORTED_FAILURES),
          ...(completedAt && { completed_at: completedAt.toISOString() }),
        },
      },
    },
  });
}

async function importTask(
  jobId: string,
  workspaceId: string,
  sourceWorkspaceId: string,
  projectId: string,
  raw: ClickUpTask,
  byEmail: Map<string, string>,
  parentId?: string,
) {
  const mapped = await prisma.importMapping.findUnique({
    where: {
      source_workspace_id_entity_type_source_id: {
        source_workspace_id: sourceWorkspaceId,
        entity_type: "task",
        source_id: raw.id,
      },
    },
  });
  if (mapped?.target_id) {
    await prisma.task.updateMany({
      where: {
        id: mapped.target_id,
        project: { workspace_id: workspaceId },
      },
      data: { status: mapStatus(raw.status?.status) },
    });
    return mapped.target_id;
  }

  const assignee = raw.assignees.find((user) => user.email)?.email?.toLowerCase();
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: raw.name,
        description: raw.description || raw.text_content || null,
        project_id: projectId,
        status: mapStatus(raw.status?.status),
        priority: mapPriority(raw.priority?.priority),
        due_date: mapDate(raw.due_date),
        position: mapPosition(raw.orderindex),
        assignee_id: assignee ? byEmail.get(assignee) ?? null : null,
        parent_id: parentId ?? null,
      },
    });
    await tx.importMapping.create({
      data: {
        job_id: jobId,
        workspace_id: workspaceId,
        source_workspace_id: sourceWorkspaceId,
        entity_type: "task",
        source_id: raw.id,
        target_id: created.id,
      },
    });
    return created;
  });

  for (const child of raw.subtasks) {
    const detail = await clickupTask(child.id);
    await importTask(
      jobId,
      workspaceId,
      sourceWorkspaceId,
      projectId,
      detail,
      byEmail,
      task.id,
    );
  }
  return task.id;
}
