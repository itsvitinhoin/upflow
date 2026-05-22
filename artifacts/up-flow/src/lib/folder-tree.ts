import type { Folder } from "@/lib/types";

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
}

export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const nodes = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] });
  }

  for (const node of nodes.values()) {
    const parentId = node.parent_id ?? null;
    const parent = parentId ? nodes.get(parentId) : null;
    if (parent && parent.space_id === node.space_id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (items: FolderTreeNode[]) => {
    items.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id);
    });
    items.forEach((item) => sortNodes(item.children));
  };

  sortNodes(roots);
  return roots;
}

export function getDescendantFolderIds(
  folders: Pick<Folder, "id" | "parent_id">[],
  folderId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parent_id) continue;
    const children = childrenByParent.get(folder.parent_id) ?? [];
    children.push(folder.id);
    childrenByParent.set(folder.parent_id, children);
  }

  const result: string[] = [];
  const stack = [...(childrenByParent.get(folderId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    result.push(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

export function wouldCreateFolderCycle(
  folders: Pick<Folder, "id" | "parent_id">[],
  folderId: string,
  nextParentId: string | null,
) {
  if (!nextParentId) return false;
  if (folderId === nextParentId) return true;
  return getDescendantFolderIds(folders, folderId).includes(nextParentId);
}
