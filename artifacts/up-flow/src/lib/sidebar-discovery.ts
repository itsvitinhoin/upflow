export type SidebarSearchResultType = "space" | "folder" | "project";

export interface SidebarSearchResult {
  id: string;
  type: SidebarSearchResultType;
  name: string;
  href: string;
  breadcrumb: string[];
}

const COLLAPSED_KEY = "upflow.sidebar.collapsedSpaces";
const SNAPSHOT_KEY = "upflow.sidebar.snapshot";

function storageScopePart(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim() || fallback;
  return encodeURIComponent(normalized);
}

export function getSidebarStorageKeys(input: {
  workspaceId?: string | null;
  userId?: string | null;
}) {
  const scope = `${storageScopePart(input.workspaceId, "no-workspace")}.${storageScopePart(
    input.userId,
    "anonymous",
  )}`;

  return {
    scope,
    collapsed: `${COLLAPSED_KEY}.${scope}`,
    snapshot: `${SNAPSHOT_KEY}.${scope}`,
  };
}

interface FolderBreadcrumbItem {
  id: string;
  name: string;
  parent_id?: string | null;
}

export function buildFolderBreadcrumb(
  folderId: string | null | undefined,
  folders: ReadonlyMap<string, FolderBreadcrumbItem>,
) {
  const path: string[] = [];
  const visited = new Set<string>();
  let cursor = folderId ? folders.get(folderId) : undefined;

  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    path.push(cursor.name);
    cursor = cursor.parent_id ? folders.get(cursor.parent_id) : undefined;
  }

  return path.reverse();
}
