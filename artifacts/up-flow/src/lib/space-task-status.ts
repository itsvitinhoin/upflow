export const SPACE_TASK_STATUS_FIELD_NAME = "Upflow Space Status";

export type SpaceTaskStatus = {
  id?: string;
  key?: string;
  name: string;
  color?: string | null;
  terminal: boolean;
  active?: boolean;
  stage_order?: number;
};

export type TaskProgressStatus = "todo" | "in_progress" | "done";

export const DEFAULT_SPACE_TASK_STATUSES: Array<{
  name: string;
  color: string;
  terminal: boolean;
}> = [
  { name: "To do", color: "#64748b", terminal: false },
  { name: "In progress", color: "#3b82f6", terminal: false },
  { name: "Done", color: "#22c55e", terminal: true },
];

export function normalizeSpaceTaskStatusName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function spaceTaskStatusKey(value: string): string {
  const slug = normalizeSpaceTaskStatusName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 68);
  return `space-${slug || "status"}`;
}

export function sortActiveSpaceTaskStatuses<T extends SpaceTaskStatus>(statuses: T[]): T[] {
  return [...statuses]
    .filter((status) => status.active !== false)
    .sort((left, right) => (left.stage_order ?? 0) - (right.stage_order ?? 0));
}

export function taskStatusForSpaceTaskStatus(
  status: { terminal?: boolean } | undefined,
  position: number,
): TaskProgressStatus {
  if (status?.terminal) return "done";
  return position <= 0 ? "todo" : "in_progress";
}

export function defaultSpaceTaskStatusName(
  statuses: SpaceTaskStatus[],
  taskStatus: TaskProgressStatus,
): string {
  const ordered = sortActiveSpaceTaskStatuses(statuses);
  if (!ordered.length) return "";

  if (taskStatus === "done") {
    return ordered.find((status) => status.terminal)?.name ?? ordered.at(-1)?.name ?? "";
  }
  if (taskStatus === "in_progress") {
    return ordered.find((status, index) => index > 0 && !status.terminal)?.name ?? ordered[0].name;
  }
  return ordered[0].name;
}

export function isValidStatusColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}
