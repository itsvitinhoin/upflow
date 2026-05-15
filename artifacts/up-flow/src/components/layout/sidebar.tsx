"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Zap,
  LayoutGrid,
  Users,
  Clock,
  Inbox,
  Calendar,
  Kanban,
  Settings,
  HelpCircle,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Layers,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppUser, Project, Space, Folder as FolderT } from "@/lib/types";
import WorkspaceSwitcher from "@/components/layout/workspace-switcher";

interface SidebarProps {
  user: AppUser;
}

const primaryNav = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/team", label: "Team", icon: Users },
  { href: "/time", label: "Time tracking", icon: Clock },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/projects", label: "Projects", icon: Kanban },
];

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
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_KEY, panelOpen ? "1" : "0");
    } catch {}
  }, [panelOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);

  const loadPanel = () => {
    setLoadingPanel(true);
    Promise.all([
      fetch("/api/spaces").then((r) => r.json() as Promise<Space[]>),
      fetch("/api/projects").then((r) => r.json() as Promise<Project[]>),
      fetch("/api/folders").then((r) => r.json() as Promise<FolderT[]>),
    ])
      .then(([s, p, f]) => {
        setSpaces(s);
        setProjects(p);
        setFolders(f);
      })
      .catch(() => {})
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
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || (pathname?.startsWith(href + "/") ?? false);

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
    const res = await fetch(`/api/spaces/${sp.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Space deleted");
      loadPanel();
    } else {
      toast.error("Could not delete space");
    }
  };

  const handleDeleteFolder = async (f: FolderT) => {
    if (!confirm(`Delete folder "${f.name}"? Lists inside will move directly under the space.`)) return;
    const res = await fetch(`/api/folders/${f.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Folder deleted");
      loadPanel();
    } else {
      toast.error("Could not delete folder");
    }
  };

  const Rail = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col items-center w-full h-full glass-rail py-4">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center justify-center w-9 h-9 rounded-xl mb-6 overflow-hidden bg-background/10 shadow-lg shadow-primary/20"
        aria-label="Up Flow"
      >
        <img src="/assets/UP_LOGO_1778594851568.png" alt="Up Flow" className="w-full h-full object-contain" />
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-2 w-full px-1">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={label}
              aria-label={label}
              className={cn(
                "relative flex flex-col items-center justify-center w-9 h-9 rounded-lg transition-colors group",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              {active && (
                <span className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}

        <button
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? "Hide spaces" : "Show spaces"}
          aria-label="Toggle spaces"
          aria-pressed={panelOpen}
          className={cn(
            "mt-1 flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
            panelOpen
              ? "text-primary bg-primary/15"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="w-[18px] h-[18px]" />
        </button>
      </nav>

      <div className="flex flex-col items-center gap-2 w-full px-1 pb-1">
        <Link
          href="/settings/import"
          aria-label="Settings"
          title="Settings · ClickUp import"
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
            pathname?.startsWith("/settings")
              ? "text-foreground bg-white/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings className="w-[18px] h-[18px]" />
        </Link>
        <button
          aria-label="Help"
          title="Help"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={handleSignOut}
          aria-label={`Sign out (${user.name || user.email || "User"})`}
          title={`Sign out · ${user.name || user.email || "User"}`}
          className="mt-2 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-[10px] font-bold hover:opacity-90 transition-opacity"
        >
          {getInitials(user.name || user.email || "U")}
        </button>
      </div>
    </div>
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
        <div className="w-[48px] flex">
          <Rail />
        </div>
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
            <div className="w-[48px] flex">
              <Rail onNavigate={() => setMobileOpen(false)} />
            </div>
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

function ProjectRow({
  project,
  onMove,
  onNavigate,
  onDeleted,
  isActive,
}: {
  project: Project;
  onMove: () => void;
  onNavigate: () => void;
  onDeleted: () => void;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && target.closest('[role="menu"], [data-menu-trigger]')) return;
      setOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", h);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", h);
    };
  }, [open]);

  const handleDelete = async () => {
    setOpen(false);
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Project deleted");
      onDeleted();
    } else {
      toast.error("Could not delete project");
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 transition-colors",
        isActive && "bg-primary/15"
      )}
    >
      <Link
        href={`/projects/${project.id}`}
        onClick={onNavigate}
        className={cn(
          "flex-1 min-w-0 text-xs truncate",
          isActive ? "text-foreground font-medium" : "text-foreground/85 hover:text-foreground"
        )}
      >
        {project.name}
      </Link>
      <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={`Actions for ${project.name}`}
          data-menu-trigger
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <MoreHorizontal className="w-3 h-3" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-40 glass-strong rounded-lg z-30 overflow-hidden text-xs"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMove();
              }}
              className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5"
            >
              <Folder className="w-3 h-3" /> Move to space…
            </button>
            <button
              role="menuitem"
              onClick={handleDelete}
              className="w-full flex items-center gap-2 text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 border-t border-white/5"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const ICONS = ["📦", "🚀", "🎨", "💼", "🛠️", "🌱", "🔬", "📈", "💡", "🗂️"];

function SpaceDialog({
  mode,
  space,
  onClose,
  onSaved,
}: {
  mode: "create" | "rename";
  space?: Space;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(space?.name ?? "");
  const [icon, setIcon] = useState(space?.icon ?? ICONS[0]);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const url = mode === "create" ? "/api/spaces" : `/api/spaces/${space!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), icon }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(mode === "create" ? "Space created" : "Space renamed");
      onSaved();
    } catch {
      toast.error("Could not save space");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="glass-strong rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">
            {mode === "create" ? "New space" : "Rename space"}
          </h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marketing"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="block text-xs font-medium text-foreground mt-4 mb-1.5">Icon</label>
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors",
                icon === i ? "bg-primary/25 ring-2 ring-primary/60" : "bg-white/5 hover:bg-white/10"
              )}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MoveProjectDialog({
  project,
  spaces,
  folders,
  onClose,
  onSaved,
}: {
  project: Project;
  spaces: Space[];
  folders: FolderT[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // value format: "" = unassigned; "space:<id>" = directly in space; "folder:<id>" = in folder
  const initial =
    project.folder_id
      ? `folder:${project.folder_id}`
      : project.space_id
      ? `space:${project.space_id}`
      : "";
  const [target, setTarget] = useState<string>(initial);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      let space_id: string | null = null;
      let folder_id: string | null = null;
      if (target.startsWith("folder:")) {
        folder_id = target.slice("folder:".length);
        const f = folders.find((x) => x.id === folder_id);
        space_id = f?.space_id ?? null;
      } else if (target.startsWith("space:")) {
        space_id = target.slice("space:".length);
      }
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_id, folder_id }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("List moved");
      onSaved();
    } catch {
      toast.error("Could not move list");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Move list</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Destination</label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Unassigned —</option>
          {spaces.map((sp) => {
            const fs = folders.filter((f) => f.space_id === sp.id);
            return (
              <optgroup key={sp.id} label={`${sp.icon || "🗂️"} ${sp.name}`}>
                <option value={`space:${sp.id}`}>↳ (directly in space)</option>
                {fs.map((f) => (
                  <option key={f.id} value={`folder:${f.id}`}>
                    📁 {f.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={loading}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

function FolderDialog({
  mode,
  space,
  folder,
  onClose,
  onSaved,
}: {
  mode: "create" | "rename";
  space?: Space;
  folder?: FolderT;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const url = mode === "create" ? "/api/folders" : `/api/folders/${folder!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body =
        mode === "create"
          ? { name: name.trim(), space_id: space!.id }
          : { name: name.trim() };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(mode === "create" ? "Folder created" : "Folder renamed");
      onSaved();
    } catch {
      toast.error("Could not save folder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="glass-strong rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {mode === "create" ? "New folder" : "Rename folder"}
            </h3>
            {mode === "create" && space && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                in {space.icon || "🗂️"} {space.name}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Q1 initiatives"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NewListDialog({
  target,
  onClose,
  onSaved,
}: {
  target:
    | { kind: "space"; space: Space }
    | { kind: "folder"; folder: FolderT };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const base = {
        name: name.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      };
      const body =
        target.kind === "space"
          ? { ...base, space_id: target.space.id }
          : {
              ...base,
              space_id: target.folder.space_id,
              folder_id: target.folder.id,
            };
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("List created");
      onSaved();
    } catch {
      toast.error("Could not create list");
    } finally {
      setLoading(false);
    }
  };

  const locationLabel =
    target.kind === "space"
      ? `${target.space.icon || "🗂️"} ${target.space.name}`
      : `📁 ${target.folder.name}`;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="glass-strong rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">New list</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">in {locationLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sprint 12"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <label className="block text-xs font-medium text-foreground mt-3 mb-1.5">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What is this list about?"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <label className="block text-xs font-medium text-foreground mt-3 mb-1.5">
          Due date <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
