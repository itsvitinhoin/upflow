export const CLICKUP_STATUS_FIELD_NAME = "ClickUp Status";

const STATUS_NAME_MAX_LENGTH = 120;
const FALLBACK_STATUS_COLORS = [
  "#64748b",
  "#14b8a6",
  "#eab308",
  "#a855f7",
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#f97316",
];

export type ClickUpStatusValue = {
  status?: string | null;
  color?: string | null;
  type?: string | null;
  orderindex?: string | number | null;
};

export type ClickUpStatusOption = {
  key: string;
  name: string;
  color: string;
  terminal: boolean;
};

function normalizedStatusName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function statusHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function validClickupColor(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/^#/, "");
  return normalized && /^[0-9a-f]{6}$/i.test(normalized)
    ? `#${normalized.toLowerCase()}`
    : null;
}

function fallbackStatusColor(value: string): string {
  let hash = 0;
  for (const char of normalizedStatusName(value)) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  }
  return FALLBACK_STATUS_COLORS[(hash >>> 0) % FALLBACK_STATUS_COLORS.length];
}

export function clickupStatusColor(value: string): string {
  return fallbackStatusColor(value);
}

function numericOrder(value: string | number | null | undefined): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function clickupStatusName(
  value: ClickUpStatusValue | null | undefined,
): string | null {
  const status = value?.status?.trim();
  return status ? status.slice(0, STATUS_NAME_MAX_LENGTH) : null;
}

export function clickupStatusKey(value: string): string {
  const normalized = normalizedStatusName(value);
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `clickup-${slug || "status"}-${statusHash(normalized)}`;
}

export function clickupStatusOptions(
  values: Array<ClickUpStatusValue | null | undefined>,
): ClickUpStatusOption[] {
  const ordered = values
    .map((value, index) => {
      const name = clickupStatusName(value);
      return name
        ? {
            value: value as ClickUpStatusValue,
            name,
            index,
            order: numericOrder(value?.orderindex),
          }
        : null;
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((left, right) => {
      if (left.order !== null && right.order !== null && left.order !== right.order) {
        return left.order - right.order;
      }
      if (left.order !== null && right.order === null) return -1;
      if (left.order === null && right.order !== null) return 1;
      return left.index - right.index;
    });

  const seen = new Set<string>();
  const result: ClickUpStatusOption[] = [];
  for (const item of ordered) {
    const identity = clickupStatusKey(item.name);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const type = item.value.type?.trim().toLowerCase();
    result.push({
      key: identity,
      name: item.name,
      color: validClickupColor(item.value.color) ?? fallbackStatusColor(item.name),
      terminal: type === "closed" || type === "done" || type === "complete",
    });
  }
  return result;
}

export function mergeClickupStatusNames(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    for (const value of group) {
      const name = clickupStatusName({ status: value });
      if (!name) continue;
      const identity = clickupStatusKey(name);
      if (seen.has(identity)) continue;
      seen.add(identity);
      result.push(name);
    }
  }
  return result;
}
