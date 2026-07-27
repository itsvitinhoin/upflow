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

export interface SidebarFolderContextItem {
  id: string;
  name: string;
  parent_id?: string | null;
}

export function buildFolderBreadcrumb(
  folderId: string | null | undefined,
  folders: ReadonlyMap<string, SidebarFolderContextItem>,
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

/**
 * Adds the folder chain required to render already-visible projects without
 * exposing unrelated hidden folders. A project nested in a hidden legacy
 * folder still needs every ancestor in the navigation payload.
 */
export async function loadSidebarFolderContext<T extends SidebarFolderContextItem>(
  initialFolders: readonly T[],
  projectFolderIds: Iterable<string | null | undefined>,
  findFolders: (folderIds: string[]) => Promise<readonly T[]>,
) {
  const folderById = new Map(initialFolders.map((folder) => [folder.id, folder]));
  const pendingFolderIds = new Set<string>();
  const addFolderContext = (folderId: string | null | undefined) => {
    if (folderId && !folderById.has(folderId)) pendingFolderIds.add(folderId);
  };

  for (const folder of initialFolders) addFolderContext(folder.parent_id);
  for (const folderId of projectFolderIds) addFolderContext(folderId);

  while (pendingFolderIds.size > 0) {
    const batchIds = Array.from(pendingFolderIds);
    pendingFolderIds.clear();

    const parentFolders = await findFolders(batchIds);
    for (const folder of parentFolders) {
      if (folderById.has(folder.id)) continue;
      folderById.set(folder.id, folder);
      addFolderContext(folder.parent_id);
    }
  }

  return folderById;
}
