"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PanelLeftClose, Search, X } from "lucide-react";
import { logError } from "@/lib/log-error";
import type { Project, Space, Folder as FolderT } from "@/lib/types";
import WorkspaceSwitcher from "@/components/layout/workspace-switcher";
import { useLanguage } from "@/components/language-provider";
import {
  SpaceDialog,
  MoveProjectDialog,
  FolderDialog,
  NewListDialog,
} from "@/components/layout/sidebar/dialogs";
import { PanelNav } from "@/components/layout/sidebar/panel-nav";
import {
  SpaceNode,
  UnassignedNode,
} from "@/components/layout/sidebar/space-tree";
import { usePanelData } from "@/components/layout/sidebar/use-panel-data";

interface PanelProps {
  pathname: string;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: "owner" | "admin" | "member";
  }>;
  currentWorkspaceId: string;
  currentRole: "owner" | "admin" | "member" | null;
  onNavigate?: () => void;
  onRequestClose?: () => void;
}

type CreateFolderTarget =
  | { kind: "space"; space: Space }
  | { kind: "folder"; folder: FolderT };

export default function Panel({
  pathname,
  workspaces,
  currentWorkspaceId,
  currentRole,
  onNavigate,
  onRequestClose,
}: PanelProps) {
  const { t } = useLanguage();
  const {
    spaces,
    folders,
    projects,
    loadingPanel,
    collapsed,
    toggleCollapse,
    menuOpenId,
    setMenuOpenId,
    loadPanel,
    collapseAll,
    upsertSpace,
  } = usePanelData(pathname);

  const [showCreate, setShowCreate] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Space | null>(null);
  const [moveTarget, setMoveTarget] = useState<Project | null>(null);
  const [createFolderTarget, setCreateFolderTarget] =
    useState<CreateFolderTarget | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderT | null>(null);
  const [createListFor, setCreateListFor] = useState<
    | { kind: "space"; space: Space }
    | { kind: "folder"; folder: FolderT }
    | null
  >(null);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const normalizedQuery = sidebarQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadPanel({ force: isSearching, query: sidebarQuery.trim() });
    }, isSearching ? 250 : 0);

    return () => window.clearTimeout(handle);
  }, [isSearching, loadPanel, sidebarQuery]);

  const visibleTree = useMemo(() => {
    if (!isSearching) {
      return {
        spaces,
        folderIds: new Set(folders.map((folder) => folder.id)),
        projectIds: new Set(projects.map((project) => project.id)),
      };
    }

    const folderById = new Map(folders.map((folder) => [folder.id, folder]));
    const spaceIds = new Set<string>();
    const folderIds = new Set<string>();
    const projectIds = new Set<string>();

    const includeFolderAncestors = (folderId: string | null | undefined) => {
      let folder = folderId ? folderById.get(folderId) : null;
      while (folder) {
        folderIds.add(folder.id);
        spaceIds.add(folder.space_id);
        folder = folder.parent_id ? folderById.get(folder.parent_id) : null;
      }
    };

    for (const space of spaces) {
      if (space.name.toLowerCase().includes(normalizedQuery)) {
        spaceIds.add(space.id);
        for (const folder of folders) {
          if (folder.space_id === space.id && !folder.parent_id) folderIds.add(folder.id);
        }
        for (const project of projects) {
          if ((project.space_id ?? null) === space.id && !project.folder_id) projectIds.add(project.id);
        }
      }
    }

    for (const folder of folders) {
      if (folder.name.toLowerCase().includes(normalizedQuery)) {
        folderIds.add(folder.id);
        spaceIds.add(folder.space_id);
        includeFolderAncestors(folder.parent_id);
        for (const child of folders) {
          if (child.parent_id === folder.id) folderIds.add(child.id);
        }
        for (const project of projects) {
          if ((project.folder_id ?? null) === folder.id) projectIds.add(project.id);
        }
      }
    }

    for (const project of projects) {
      if (project.name.toLowerCase().includes(normalizedQuery)) {
        projectIds.add(project.id);
        if (project.space_id) spaceIds.add(project.space_id);
        includeFolderAncestors(project.folder_id);
      }
    }

    return {
      spaces: spaces.filter((space) => spaceIds.has(space.id)),
      folderIds,
      projectIds,
    };
  }, [folders, isSearching, normalizedQuery, projects, spaces]);

  const projectsBySpace = (spaceId: string | null) =>
    projects.filter(
      (p) => (p.space_id ?? null) === spaceId && (!isSearching || visibleTree.projectIds.has(p.id)),
    );
  const foldersBySpace = (spaceId: string) =>
    folders.filter(
      (f) => f.space_id === spaceId && !f.parent_id && (!isSearching || visibleTree.folderIds.has(f.id)),
    );
  const childFoldersByParent = (parentId: string) =>
    folders.filter((f) => f.parent_id === parentId && (!isSearching || visibleTree.folderIds.has(f.id)));
  const projectsByFolder = (folderId: string) =>
    projects.filter((p) => (p.folder_id ?? null) === folderId && (!isSearching || visibleTree.projectIds.has(p.id)));
  const projectsInSpaceLoose = (spaceId: string) =>
    projects.filter(
      (p) => (p.space_id ?? null) === spaceId && !p.folder_id && (!isSearching || visibleTree.projectIds.has(p.id)),
    );

  const handleDeleteSpace = async (sp: Space) => {
    if (!confirm(`Delete space "${sp.name}"? Folders inside will be deleted; lists will become unfiled.`)) return;
    try {
      const res = await fetch(`/api/spaces/${sp.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Space deleted");
        loadPanel({ force: true });
      } else {
        toast.error("Could not delete space");
      }
    } catch (err) {
      logError("sidebar:delete-space", err, { id: sp.id });
      toast.error("Could not delete space");
    }
  };

  const handleDeleteFolder = async (f: FolderT) => {
    if (!confirm(`Delete folder "${f.name}"? Child folders and lists will move up one level.`)) return;
    try {
      const res = await fetch(`/api/folders/${f.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Folder deleted");
        loadPanel({ force: true });
      } else {
        toast.error("Could not delete folder");
      }
    } catch (err) {
      logError("sidebar:delete-folder", err, { id: f.id });
      toast.error("Could not delete folder");
    }
  };

  const treeHandlers = {
    collapsed,
    toggleCollapse,
    menuOpenId,
    setMenuOpenId,
    pathname,
    onNavigate,
    loadPanel,
    setMoveTarget,
    setRenameTarget,
    setCreateFolderTarget,
    setRenameFolderTarget,
    setCreateListFor,
    handleDeleteSpace,
    handleDeleteFolder,
  };

  const unassignedItems = projectsBySpace(null);

  return (
    <>
      <div className="flex flex-col h-full w-full glass-rail border-l border-white/5">
        <WorkspaceSwitcher
          initialData={{
            workspaces,
            current_workspace_id: currentWorkspaceId,
            current_role: currentRole,
          }}
        />
        {onRequestClose && (
          <div className="flex justify-end px-3 pb-2">
            <button
              type="button"
              onClick={onRequestClose}
              aria-label={t("sidebar.hide")}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
              {t("sidebar.hide")}
            </button>
          </div>
        )}
        <PanelNav
          pathname={pathname}
          onNavigate={onNavigate}
          onCreateSpace={() => setShowCreate(true)}
          onCollapseAll={() =>
            collapseAll([
              ...spaces.map((space) => space.id),
              ...folders.map((folder) => folder.id),
              "__unassigned__",
            ])
          }
        />

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          <div className="sticky top-0 z-10 bg-background/80 pb-2 pt-1 backdrop-blur">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={sidebarQuery}
                onChange={(event) => setSidebarQuery(event.target.value)}
                placeholder={t("sidebar.searchSpaces")}
                className="h-8 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-8 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
              />
              {sidebarQuery && (
                <button
                  type="button"
                  onClick={() => setSidebarQuery("")}
                  aria-label={t("sidebar.clearSearch")}
                  className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
          </div>
          {loadingPanel ? (
            <div className="px-2 py-4 text-xs text-muted-foreground">
              {t("sidebar.loading")}
            </div>
          ) : (
            <>
              {visibleTree.spaces.map((sp) => (
                <SpaceNode
                  key={sp.id}
                  space={sp}
                  looseLists={projectsInSpaceLoose(sp.id)}
                  foldersBySpace={foldersBySpace(sp.id)}
                  childFoldersByParent={childFoldersByParent}
                  projectsByFolder={projectsByFolder}
                  isSearching={isSearching}
                  {...treeHandlers}
                />
              ))}

              {isSearching && visibleTree.spaces.length === 0 && unassignedItems.length === 0 && (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  {t("sidebar.noSearchMatches", { query: sidebarQuery.trim() })}
                </div>
              )}

              {((isSearching && unassignedItems.length > 0) ||
                (!isSearching && !(unassignedItems.length === 0 && spaces.length > 0))) && (
                <UnassignedNode
                  items={unassignedItems}
                  collapsed={collapsed}
                  toggleCollapse={toggleCollapse}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  loadPanel={loadPanel}
                  setMoveTarget={setMoveTarget}
                  isSearching={isSearching}
                />
              )}

              {!isSearching && spaces.length === 0 && unassignedItems.length === 0 && (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  <p>{t("sidebar.noSpaces")}</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-2 text-primary hover:underline"
                  >
                    {t("sidebar.createFirstSpace")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <SpaceDialog
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={(space) => {
            setShowCreate(false);
            setSidebarQuery("");
            upsertSpace(space);
            loadPanel({ force: true });
          }}
        />
      )}

      {renameTarget && (
        <SpaceDialog
          mode="rename"
          space={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSaved={(space) => {
            setRenameTarget(null);
            upsertSpace(space);
            loadPanel({ force: true });
          }}
        />
      )}

      {moveTarget && (
        <MoveProjectDialog
          project={moveTarget}
          spaces={spaces}
          folders={folders}
          onClose={() => setMoveTarget(null)}
          onSaved={() => {
            setMoveTarget(null);
            loadPanel({ force: true });
          }}
        />
      )}

      {createFolderTarget && (
        <FolderDialog
          mode="create"
          target={createFolderTarget}
          onClose={() => setCreateFolderTarget(null)}
          onSaved={() => {
            setCreateFolderTarget(null);
            loadPanel({ force: true });
          }}
        />
      )}

      {renameFolderTarget && (
        <FolderDialog
          mode="rename"
          folder={renameFolderTarget}
          onClose={() => setRenameFolderTarget(null)}
          onSaved={() => {
            setRenameFolderTarget(null);
            loadPanel({ force: true });
          }}
        />
      )}

      {createListFor && (
        <NewListDialog
          target={createListFor}
          onClose={() => setCreateListFor(null)}
          onSaved={() => {
            setCreateListFor(null);
            loadPanel({ force: true });
          }}
        />
      )}
    </>
  );
}
