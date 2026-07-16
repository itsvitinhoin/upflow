import type { Prisma } from "@prisma/client";

export const PROJECT_DIRECTORY_TABS = [
  "clients",
  "internal",
  "operations",
  "archived",
] as const;

export const PROJECT_DIRECTORY_SORTS = ["name", "newest", "due"] as const;

export type ProjectDirectoryTab = (typeof PROJECT_DIRECTORY_TABS)[number];
export type ProjectDirectorySort = (typeof PROJECT_DIRECTORY_SORTS)[number];

export interface ProjectDirectoryQuery {
  tab: ProjectDirectoryTab;
  q: string;
  space: string | null;
  folder: string | null;
  sort: ProjectDirectorySort;
  cursor: string | null;
  limit: number;
}

export type ProjectDirectoryQueryResult =
  | { ok: true; value: ProjectDirectoryQuery }
  | { ok: false; error: string };

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 200;

function isOneOf<T extends readonly string[]>(
  value: string,
  choices: T,
): value is T[number] {
  return choices.includes(value);
}

function optionalParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)?.trim() ?? "";
  return value || null;
}

export function parseProjectDirectoryQuery(
  params: URLSearchParams,
): ProjectDirectoryQueryResult {
  const rawTab = optionalParam(params, "tab") ?? "clients";
  if (!isOneOf(rawTab, PROJECT_DIRECTORY_TABS)) {
    return { ok: false, error: "Invalid tab" };
  }

  const rawSort = optionalParam(params, "sort") ?? "name";
  if (!isOneOf(rawSort, PROJECT_DIRECTORY_SORTS)) {
    return { ok: false, error: "Invalid sort" };
  }

  const q = optionalParam(params, "q") ?? "";
  if (q.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: "Query too long" };
  }

  const space = optionalParam(params, "space");
  const folder = optionalParam(params, "folder");
  const cursor = optionalParam(params, "cursor");
  if (
    [space, folder, cursor].some(
      (value) => value !== null && value.length > MAX_QUERY_LENGTH,
    )
  ) {
    return { ok: false, error: "Invalid directory parameter" };
  }

  const rawLimit = optionalParam(params, "limit");
  const parsedLimit = rawLimit === null ? DEFAULT_LIMIT : Number.parseInt(rawLimit, 10);
  const limit = Math.min(
    Math.max(1, Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  return {
    ok: true,
    value: {
      tab: rawTab,
      q,
      space,
      folder,
      sort: rawSort,
      cursor,
      limit,
    },
  };
}

export function directoryTabWhere(
  tab: ProjectDirectoryTab,
): Prisma.ProjectWhereInput {
  switch (tab) {
    case "clients":
      return { status: "active", kind: "client" };
    case "internal":
      return { status: "active", kind: "internal" };
    case "operations":
      return { status: "active", kind: "operational_queue" };
    case "archived":
      return { status: "archived", kind: { not: "onboarding" } };
  }
}

export function buildProjectDirectoryWhere(
  readableScope: Prisma.ProjectWhereInput,
  query: Pick<ProjectDirectoryQuery, "tab" | "q" | "space" | "folder">,
): Prisma.ProjectWhereInput {
  const filters: Prisma.ProjectWhereInput[] = [
    readableScope,
    directoryTabWhere(query.tab),
  ];

  if (query.space) filters.push({ space_id: query.space });
  if (query.folder) filters.push({ folder_id: query.folder });
  if (query.q) {
    filters.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { company: { name: { contains: query.q, mode: "insensitive" } } },
        { space: { name: { contains: query.q, mode: "insensitive" } } },
        { folder: { name: { contains: query.q, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: filters };
}

export function projectDirectoryOrderBy(
  sort: ProjectDirectorySort,
): Prisma.ProjectOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ created_at: "desc" }, { id: "asc" }];
    case "due":
      return [
        { due_date: { sort: "asc", nulls: "last" } },
        { name: "asc" },
        { id: "asc" },
      ];
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
  }
}
