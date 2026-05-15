"use client";

import { useState } from "react";
import { toast } from "sonner";
import { logError } from "@/lib/log-error";
import type { Project, Space, Folder as FolderT } from "@/lib/types";
import WorkspaceSwitcher from "@/components/layout/workspace-switcher";
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
  onNavigate?: () => void;
}

export default function Panel({ pathname, onNavigate }: PanelProps) {
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
  } = usePanelData(pathname);

  const [showCreate, setShowCreate] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Space | null>(null);
  const [moveTarget, setMoveTarget] = useState<Project | null>(null);
  const [createFolderForSpace, setCreateFolderForSpace] =
    useState<Space | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderT | null>(null);
  const [createListFor, setCreateListFor] = useState<
    | { kind: "space"; space: Space }
    | { kind: "folder"; folder: FolderT }
    | null
  >(null);

  const projectsBySpace = (spaceId: string | null) =>
    projects.filter((p) => (p.space_id ?? null) === spaceId);
  const foldersBySpace = (spaceId: string) =>
    folders.filter((f) => f.space_id === spaceId);
  const projectsByFolder = (folderId: string) =>
    projects.filter((p) => (p.folder_id ?? null) === folderId);
  const projectsInSpaceLoose = (spaceId: string) =>
    projects.filter((p) => (p.space_id ?? null) === spaceId && !p.folder_id);

  const handleDeleteSpace = async (sp: Space) => {
    if (!confirm(`Delete space "${sp.name}"? Folders inside will be deleted; lists will become unfiled.`)) return;
    try {
      const res = await fetch(`/api/spaces/${sp.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Space deleted");
        loadPanel();
      } else {
        toast.error("Could not delete space");
      }
    } catch (err) {
      logError("sidebar:delete-space", err, { id: sp.id });
      toast.error("Could not delete space");
    }
  };

  const handleDeleteFolder = async (f: FolderT) => {
    if (!confirm(`Delete folder "${f.name}"? Lists inside will move directly under the space.`)) return;
    try {
      const res = await fetch(`/api/folders/${f.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Folder deleted");
        loadPanel();
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
    setCreateFolderForSpace,
    setRenameFolderTarget,
    setCreateListFor,
    handleDeleteSpace,
    handleDeleteFolder,
  };

  const unassignedItems = projectsBySpace(null);

  return (
    <>
      <div className="flex flex-col h-full w-full glass-rail border-l border-white/5">
        <WorkspaceSwitcher />
        <PanelNav
          pathname={pathname}
          onNavigate={onNavigate}
          onCreateSpace={() => setShowCreate(true)}
        />

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {loadingPanel ? (
            <div className="px-2 py-4 text-xs text-muted-foreground">Loading…</div>
          ) : (
            <>
              {spaces.map((sp) => (
                <SpaceNode
                  key={sp.id}
                  space={sp}
                  folders={folders}
                  looseLists={projectsInSpaceLoose(sp.id)}
                  foldersBySpace={foldersBySpace(sp.id)}
                  totalCount={projectsBySpace(sp.id).length}
                  projectsByFolder={projectsByFolder}
                  {...treeHandlers}
                />
              ))}

              {!(unassignedItems.length === 0 && spaces.length > 0) && (
                <UnassignedNode
                  items={unassignedItems}
                  collapsed={collapsed}
                  toggleCollapse={toggleCollapse}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  loadPanel={loadPanel}
                  setMoveTarget={setMoveTarget}
                />
              )}

              {spaces.length === 0 && unassignedItems.length === 0 && (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  <p>No spaces yet.</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-2 text-primary hover:underline"
                  >
                    Create your first space
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
          onSaved={() => {
            setShowCreate(false);
            loadPanel();
          }}
        />
      )}

      {renameTarget && (
        <SpaceDialog
          mode="rename"
          space={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSaved={() => {
            setRenameTarget(null);
            loadPanel();
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
            loadPanel();
          }}
        />
      )}

      {createFolderForSpace && (
        <FolderDialog
          mode="create"
          space={createFolderForSpace}
          onClose={() => setCreateFolderForSpace(null)}
          onSaved={() => {
            setCreateFolderForSpace(null);
            loadPanel();
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
            loadPanel();
          }}
        />
      )}

      {createListFor && (
        <NewListDialog
          target={createListFor}
          onClose={() => setCreateListFor(null)}
          onSaved={() => {
            setCreateListFor(null);
            loadPanel();
          }}
        />
      )}
    </>
  );
}
