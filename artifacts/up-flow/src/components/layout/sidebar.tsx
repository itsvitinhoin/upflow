"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log-error";
import type { AppUser, Project, Space, Folder as FolderT } from "@/lib/types";
import WorkspaceSwitcher from "@/components/layout/workspace-switcher";
import { Rail, primaryNav } from "@/components/layout/sidebar/rail";
import { ProjectRow } from "@/components/layout/sidebar/project-row";
import {
  SpaceDialog,
  MoveProjectDialog,
  FolderDialog,
  NewListDialog,
} from "@/components/layout/sidebar/dialogs";

interface SidebarProps {
  user: AppUser;
}

const PANEL_KEY = "upflow.sidebar.spacesOpen";
const COLLAPSED_KEY = "upflow.sidebar.collapsedSpaces";

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [folders, setFolders] = useState<FolderT[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loadingPanel, setLoadingPanel] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Space | null>(null);
  const [moveTarget, setMoveTarget] = useState<Project | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [createFolderForSpace, setCreateFolderForSpace] = useState<Space | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<FolderT | null>(null);
  const [createListFor, setCreateListFor] = useState<
    | { kind: "space"; space: Space }
    | { kind: "folder"; folder: FolderT }
    | null
  >(null);

  // hydrate panel state
  useEffect(() => {
    try {
      const v = localStorage.getItem(PANEL_KEY);
      if (v !== null) setPanelOpen(v === "1");
      const c = localStorage.getItem(COLLAPSED_KEY);
      if (c) setCollapsed(JSON.parse(c) as Record<string, boolean>);
    } catch {
      // localStorage unavailable (SSR, privacy modes) — use defaults.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_KEY, panelOpen ? "1" : "0");
    } catch {
      // localStorage unavailable — panel state simply won't persist.
    }
  }, [panelOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      // localStorage unavailable — collapsed state simply won't persist.
    }
  }, [collapsed]);

  const loadPanel = () => {
    setLoadingPanel(true);
    Promise.all([
      fetch("/api/spaces").then((r) => r.json() as Promise<{ items: Space[] }>),
      fetch("/api/projects").then((r) => r.json() as Promise<{ items: Project[] }>),
      fetch("/api/folders").then((r) => r.json() as Promise<{ items: FolderT[] }>),
    ])
      .then(([s, p, f]) => {
        setSpaces(s.items ?? []);
        setProjects(p.items ?? []);
        setFolders(f.items ?? []);
      })
      .catch((err) => logError("sidebar:loadPanel", err))
      .finally(() => setLoadingPanel(false));
  };

  useEffect(() => {
    loadPanel();
  }, []);

  // Refresh panel when navigating between routes (catches changes done elsewhere)
  useEffect(() => {
    loadPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Refresh panel when other parts of the app emit a refresh event
  useEffect(() => {
    const handler = () => loadPanel();
    window.addEventListener("upflow:sidebar-refresh", handler);
    return () => window.removeEventListener("upflow:sidebar-refresh", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close action menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && target.closest('[role="menu"], [data-menu-trigger]')) return;
      setMenuOpenId(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", handle);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", handle);
    };
  }, [menuOpenId]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
    } catch (err) {
      logError("sidebar:sign-out", err);
      toast.error("Sign-out failed; please try again");
      setSigningOut(false);
    }
  };

  const projectsBySpace = (spaceId: string | null) =>
    projects.filter((p) => (p.space_id ?? null) === spaceId);

  const foldersBySpace = (spaceId: string) =>
    folders.filter((f) => f.space_id === spaceId);

  const projectsByFolder = (folderId: string) =>
    projects.filter((p) => (p.folder_id ?? null) === folderId);

  const projectsInSpaceLoose = (spaceId: string) =>
    projects.filter(
      (p) => (p.space_id ?? null) === spaceId && !p.folder_id
    );

  const toggleCollapse = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

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

  const renderRail = (onNavigate?: () => void) => (
    <Rail
      user={user}
      pathname={pathname}
      panelOpen={panelOpen}
      onTogglePanel={() => setPanelOpen((v) => !v)}
      onSignOut={handleSignOut}
      onNavigate={onNavigate}
    />
  );

  const Panel = () => (
    <div className="flex flex-col h-full w-full glass-rail border-l border-white/5">
      <WorkspaceSwitcher />
      <div className="px-4 pt-4 pb-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Navigation
        </p>
      </div>
      <nav className="px-2 pb-2 space-y-0.5">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                active
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-3 border-t border-white/5" />
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Workspace</p>
          <h3 className="text-sm font-semibold text-foreground">Spaces</h3>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          aria-label="New space"
          title="New space"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {loadingPanel ? (
          <div className="px-2 py-4 text-xs text-muted-foreground">Loading…</div>
        ) : (
          <>
            {spaces.map((sp) => {
              const isCollapsed = !!collapsed[sp.id];
              const spaceFolders = foldersBySpace(sp.id);
              const looseLists = projectsInSpaceLoose(sp.id);
              const totalCount = projectsBySpace(sp.id).length;
              const menuOpen = menuOpenId === sp.id;
              return (
                <div key={sp.id} className="rounded-lg">
                  <div className="group relative flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-white/5">
                    <button
                      onClick={() => toggleCollapse(sp.id)}
                      aria-label={isCollapsed ? "Expand" : "Collapse"}
                      className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="text-base leading-none">{sp.icon || "🗂️"}</span>
                    <button
                      onClick={() => toggleCollapse(sp.id)}
                      className="flex-1 text-left text-xs font-semibold text-foreground truncate"
                    >
                      {sp.name}
                    </button>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {totalCount}
                    </span>
                    <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                      <button
                        onClick={() =>
                          setMenuOpenId((id) => (id === sp.id ? null : sp.id))
                        }
                        aria-label={`Actions for ${sp.name}`}
                        data-menu-trigger
                        className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                      {menuOpen && (
                        <div
                          role="menu"
                          className="absolute right-0 top-full mt-1 w-44 glass-strong rounded-lg z-30 overflow-hidden text-xs"
                        >
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenuOpenId(null);
                              setCreateListFor({ kind: "space", space: sp });
                            }}
                            className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5"
                          >
                            <Plus className="w-3 h-3" /> New list
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenuOpenId(null);
                              setCreateFolderForSpace(sp);
                            }}
                            className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5"
                          >
                            <Folder className="w-3 h-3" /> New folder
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenuOpenId(null);
                              setRenameTarget(sp);
                            }}
                            className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5 border-t border-white/5"
                          >
                            <Pencil className="w-3 h-3" /> Rename
                          </button>
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenuOpenId(null);
                              handleDeleteSpace(sp);
                            }}
                            className="w-full flex items-center gap-2 text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 border-t border-white/5"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="ml-5 pl-2 border-l border-white/5 space-y-0.5 mt-0.5">
                      {spaceFolders.length === 0 && looseLists.length === 0 && (
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground/70 italic">
                          No folders or lists yet
                        </p>
                      )}
                      {spaceFolders.map((f) => {
                        const fCollapsed = !!collapsed[f.id];
                        const fItems = projectsByFolder(f.id);
                        const fMenuOpen = menuOpenId === f.id;
                        return (
                          <div key={f.id} className="rounded-md">
                            <div className="group relative flex items-center gap-1 px-1 py-0.5 rounded-md hover:bg-white/5">
                              <button
                                onClick={() => toggleCollapse(f.id)}
                                aria-label={fCollapsed ? "Expand" : "Collapse"}
                                className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
                              >
                                {fCollapsed ? (
                                  <ChevronRight className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                              <Folder className="w-3.5 h-3.5 text-muted-foreground" />
                              <button
                                onClick={() => toggleCollapse(f.id)}
                                className="flex-1 text-left text-xs font-medium text-foreground/90 truncate"
                              >
                                {f.name}
                              </button>
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {fItems.length}
                              </span>
                              <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() =>
                                    setMenuOpenId((id) => (id === f.id ? null : f.id))
                                  }
                                  aria-label={`Actions for ${f.name}`}
                                  data-menu-trigger
                                  className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                                >
                                  <MoreHorizontal className="w-3 h-3" />
                                </button>
                                {fMenuOpen && (
                                  <div
                                    role="menu"
                                    className="absolute right-0 top-full mt-1 w-40 glass-strong rounded-lg z-30 overflow-hidden text-xs"
                                  >
                                    <button
                                      role="menuitem"
                                      onClick={() => {
                                        setMenuOpenId(null);
                                        setCreateListFor({ kind: "folder", folder: f });
                                      }}
                                      className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5"
                                    >
                                      <Plus className="w-3 h-3" /> New list
                                    </button>
                                    <button
                                      role="menuitem"
                                      onClick={() => {
                                        setMenuOpenId(null);
                                        setRenameFolderTarget(f);
                                      }}
                                      className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5 border-t border-white/5"
                                    >
                                      <Pencil className="w-3 h-3" /> Rename
                                    </button>
                                    <button
                                      role="menuitem"
                                      onClick={() => {
                                        setMenuOpenId(null);
                                        handleDeleteFolder(f);
                                      }}
                                      className="w-full flex items-center gap-2 text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 border-t border-white/5"
                                    >
                                      <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {!fCollapsed && (
                              <div className="ml-4 pl-2 border-l border-white/5 space-y-0.5 mt-0.5">
                                {fItems.length === 0 ? (
                                  <p className="px-2 py-1 text-[11px] text-muted-foreground/70 italic">
                                    No lists yet
                                  </p>
                                ) : (
                                  fItems.map((p) => (
                                    <ProjectRow
                                      key={p.id}
                                      project={p}
                                      onMove={() => setMoveTarget(p)}
                                      onNavigate={() => setMobileOpen(false)}
                                      onDeleted={loadPanel}
                                      isActive={pathname === `/projects/${p.id}`}
                                    />
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {looseLists.map((p) => (
                        <ProjectRow
                          key={p.id}
                          project={p}
                          onMove={() => setMoveTarget(p)}
                          onNavigate={() => setMobileOpen(false)}
                          onDeleted={loadPanel}
                          isActive={pathname === `/projects/${p.id}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned bucket */}
            {(() => {
              const items = projectsBySpace(null);
              if (items.length === 0 && spaces.length > 0) return null;
              const id = "__unassigned__";
              const isCollapsed = !!collapsed[id];
              return (
                <div className="rounded-lg pt-2 mt-2 border-t border-white/5">
                  <div className="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-white/5">
                    <button
                      onClick={() => toggleCollapse(id)}
                      aria-label={isCollapsed ? "Expand" : "Collapse"}
                      className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <Folder className="w-3.5 h-3.5 text-muted-foreground" />
                    <button
                      onClick={() => toggleCollapse(id)}
                      className="flex-1 text-left text-xs font-semibold text-muted-foreground truncate"
                    >
                      Unassigned
                    </button>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {items.length}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="ml-5 pl-2 border-l border-white/5 space-y-0.5 mt-0.5">
                      {items.length === 0 ? (
                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground/70 italic">
                          Nothing here
                        </p>
                      ) : (
                        items.map((p) => (
                          <ProjectRow
                            key={p.id}
                            project={p}
                            onMove={() => setMoveTarget(p)}
                            onNavigate={() => setMobileOpen(false)}
                            onDeleted={loadPanel}
                            isActive={pathname === `/projects/${p.id}`}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {spaces.length === 0 && projectsBySpace(null).length === 0 && (
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
  );

  return (
    <>
      <aside className="hidden md:flex flex-shrink-0">
        <div className="w-[48px] flex">{renderRail()}</div>
        {panelOpen && (
          <div className="w-[240px] flex">
            <Panel />
          </div>
        )}
      </aside>

      <div className="md:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          className="bg-card border border-border text-foreground p-2 rounded-lg shadow-lg"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed left-0 top-0 h-full z-50 shadow-2xl border-r border-sidebar-border flex">
            <div className="w-[48px] flex">{renderRail(() => setMobileOpen(false))}</div>
            <div className="w-[240px] flex">
              <Panel />
            </div>
          </aside>
        </>
      )}

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
