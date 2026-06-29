"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LogOut, PanelLeftClose, Plus, Search, Settings2, Sparkles, X } from "lucide-react";
import { logError } from "@/lib/log-error";
import type { Project, Space, Folder as FolderT } from "@/lib/types";
import InviteDialog from "@/components/dashboard/invite-dialog";
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
    role: "owner" | "admin" | "member" | "guest";
  }>;
  currentWorkspaceId: string;
  currentRole: "owner" | "admin" | "member" | "guest" | null;
  isSuperAdmin?: boolean;
  onNavigate?: () => void;
  onRequestClose?: () => void;
  onSignOut: () => void;
  signingOut?: boolean;
}

type CreateFolderTarget =
  | { kind: "space"; space: Space }
  | { kind: "folder"; folder: FolderT };

export default function Panel({
  pathname,
  workspaces,
  currentWorkspaceId,
  currentRole,
  isSuperAdmin = false,
  onNavigate,
  onRequestClose,
  onSignOut,
  signingOut = false,
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
  const [shareTarget, setShareTarget] = useState<Space | null>(null);
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
  const canManageWorkspace =
    isSuperAdmin || currentRole === "owner" || currentRole === "admin";

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
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? "Could not delete space");
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
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? "Could not delete folder");
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
    canManageWorkspace,
    loadPanel,
    setMoveTarget,
    setRenameTarget,
    setShareTarget,
    setCreateFolderTarget,
    setRenameFolderTarget,
    setCreateListFor,
    handleDeleteSpace,
    handleDeleteFolder,
  };

  const unassignedItems = projectsBySpace(null);

  return (
    <>
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-blue-300/10 bg-[#050816] text-sidebar-foreground shadow-[inset_-1px_0_0_rgba(96,165,250,0.06)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_8%,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_95%_34%,rgba(139,92,246,0.12),transparent_28%)]" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-px bg-gradient-to-b from-blue-400/30 via-violet-400/18 to-transparent" />
        <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col">
          <div className="shrink-0">
            <WorkspaceSwitcher
              initialData={{
                workspaces,
                current_workspace_id: currentWorkspaceId,
                current_role: currentRole,
                is_super_admin: isSuperAdmin,
              }}
            />
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 pb-2">
              <Link
                href="/settings"
                onClick={onNavigate}
                className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-blue-300/12 bg-white/[0.04] px-2 text-[11px] font-semibold text-blue-100/85 transition-all hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-white hover:shadow-[0_0_20px_rgba(59,130,246,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Settings2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{t("sidebar.settings")}</span>
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                disabled={signingOut}
                className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-rose-300/15 bg-rose-500/[0.07] px-2 text-[11px] font-semibold text-rose-100/85 transition-all hover:border-rose-300/35 hover:bg-rose-500/12 hover:text-white hover:shadow-[0_0_20px_rgba(244,63,94,0.14)] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">
                  {signingOut ? t("common.loading") : t("sidebar.signOut")}
                </span>
              </button>
              {onRequestClose ? (
                <button
                  type="button"
                  onClick={onRequestClose}
                  aria-label={t("sidebar.hide")}
                  title={t("sidebar.hide")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-foreground"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [scrollbar-gutter:stable]">
            <PanelNav
              pathname={pathname}
              onNavigate={onNavigate}
              onCreateSpace={() => setShowCreate(true)}
              canManageWorkspace={canManageWorkspace}
              onCollapseAll={() =>
                collapseAll([
                  ...spaces.map((space) => space.id),
                  ...folders.map((folder) => folder.id),
                  "__unassigned__",
                ])
              }
            />

            <div className="space-y-1 px-2">
              <div className="sticky top-0 z-10 -mx-2 bg-[#050816]/92 px-2 pb-2 pt-1 backdrop-blur-md">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={sidebarQuery}
                    onChange={(event) => setSidebarQuery(event.target.value)}
                    placeholder={t("sidebar.searchSpaces")}
                    className="h-9 w-full rounded-xl border border-blue-300/10 bg-[#071024]/80 pl-8 pr-8 text-xs text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_22px_rgba(37,99,235,0.06)] outline-none transition placeholder:text-muted-foreground hover:border-blue-300/25 focus:border-sky-400/55 focus:ring-2 focus:ring-sky-400/20"
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
                      canManageWorkspace={canManageWorkspace}
                    />
                  )}

                  {!isSearching && spaces.length === 0 && unassignedItems.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">{t("sidebar.noSpaces")}</p>
                      <p className="mt-2 leading-5">{t("sidebar.noSpacesHint")}</p>
                      {canManageWorkspace ? (
                        <button
                          type="button"
                          onClick={() => setShowCreate(true)}
                          className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                        >
                          {t("sidebar.createFirstSpace")}
                        </button>
                      ) : (
                        <p className="mt-3 rounded-xl border border-blue-300/12 bg-blue-500/[0.06] p-2 text-[11px] leading-5 text-blue-100/70">
                          {t("sidebar.noSpacesViewOnly")}
                        </p>
                      )}
                    </div>
                  )}

                  {!isSearching && canManageWorkspace && (spaces.length > 0 || unassignedItems.length > 0) && (
                    <button
                      type="button"
                      onClick={() => setShowCreate(true)}
                      className="group relative mt-3 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-blue-300/20 bg-gradient-to-br from-blue-600/18 via-violet-600/14 to-fuchsia-500/10 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_30px_rgba(59,130,246,0.12)] transition-all hover:-translate-y-0.5 hover:border-blue-300/35 hover:shadow-[0_0_36px_rgba(99,102,241,0.22)]"
                    >
                      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.09),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.25),transparent_30%)] opacity-80" />
                      <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/18 text-blue-100 ring-1 ring-blue-300/25">
                        <Plus className="h-4 w-4" />
                      </span>
                      <span className="relative min-w-0">
                        <span className="block text-xs font-semibold text-foreground">{t("sidebar.newSpace")}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-blue-100/55">
                          {t("sidebar.newSpaceHint")}
                        </span>
                      </span>
                      <Sparkles className="relative ml-auto h-3.5 w-3.5 flex-shrink-0 text-violet-200/70 opacity-70 transition group-hover:opacity-100" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
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

      {shareTarget && (
        <InviteDialog
          open
          onClose={() => setShareTarget(null)}
          title={t("space.shareSpaceTitle", { space: shareTarget.name })}
          description={t("space.shareSpaceDescription", {
            space: shareTarget.name,
            workspace:
              workspaces.find((workspace) => workspace.id === currentWorkspaceId)?.name ||
              t("invite.currentWorkspace"),
          })}
          submitLabel={t("invite.submitDefault")}
          successLabel={t("invite.successDefault")}
          workspaceId={shareTarget.workspace_id || currentWorkspaceId}
          defaultRole="member"
          defaultMode="workspace_access"
          hideMode
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
