"use client";

import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  UserPlus,
  Trash2,
} from "lucide-react";
import type { Project, Space, Folder as FolderT } from "@/lib/types";
import { ProjectRow } from "@/components/layout/sidebar/project-row";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_CHILDREN = 8;

export interface NodeHandlers {
  collapsed: Record<string, boolean>;
  toggleCollapse: (id: string) => void;
  menuOpenId: string | null;
  setMenuOpenId: (updater: (id: string | null) => string | null) => void;
  pathname: string;
  onNavigate?: () => void;
  canManageWorkspace: boolean;
  loadPanel: () => void;
  setMoveTarget: (p: Project) => void;
  setRenameTarget: (s: Space) => void;
  setCreateFolderTarget: (
    v: { kind: "space"; space: Space } | { kind: "folder"; folder: FolderT },
  ) => void;
  setRenameFolderTarget: (f: FolderT) => void;
  setCreateListFor: (
    v: { kind: "space"; space: Space } | { kind: "folder"; folder: FolderT },
  ) => void;
  setShareTarget: (s: Space) => void;
  handleDeleteSpace: (s: Space) => void;
  handleDeleteFolder: (f: FolderT) => void;
}

interface SpaceNodeProps extends NodeHandlers {
  space: Space;
  looseLists: Project[];
  foldersBySpace: FolderT[];
  childFoldersByParent: (id: string) => FolderT[];
  projectsByFolder: (id: string) => Project[];
  isSearching: boolean;
}

export function SpaceNode({
  space: sp,
  looseLists,
  foldersBySpace: spaceFolders,
  childFoldersByParent,
  projectsByFolder,
  isSearching,
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
  setCreateFolderTarget,
  setRenameFolderTarget,
  setCreateListFor,
  setShareTarget,
  handleDeleteSpace,
  handleDeleteFolder,
}: SpaceNodeProps) {
  const { t } = useLanguage();
  const isCollapsed = !!collapsed[sp.id];
  const menuOpen = menuOpenId === sp.id;
  const isActive = pathname === `/spaces/${sp.id}`;
  const directChildCount = spaceFolders.length + looseLists.length;
  const visibleFolders = isSearching ? spaceFolders : spaceFolders.slice(0, MAX_VISIBLE_CHILDREN);
  const remainingListSlots = isSearching ? looseLists.length : Math.max(0, MAX_VISIBLE_CHILDREN - visibleFolders.length);
  const visibleLooseLists = isSearching ? looseLists : looseLists.slice(0, remainingListSlots);
  const hiddenChildCount = directChildCount - visibleFolders.length - visibleLooseLists.length;
  return (
    <div className="rounded-2xl">
      <div
        className={cn(
          "group relative flex items-center gap-1 overflow-visible rounded-2xl border px-1.5 py-1.5 transition-all",
          isActive
            ? "border-blue-300/30 bg-gradient-to-r from-blue-600/28 via-violet-600/20 to-blue-500/10 shadow-[0_0_30px_rgba(37,99,235,0.24),inset_0_1px_0_rgba(255,255,255,0.12)]"
            : "border-transparent bg-white/[0.025] hover:border-blue-300/15 hover:bg-white/[0.055] hover:shadow-[0_0_24px_rgba(59,130,246,0.10)]",
        )}
      >
        {isActive && (
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_50%,rgba(96,165,250,0.22),transparent_42%)]" />
        )}
        <button
          onClick={() => toggleCollapse(sp.id)}
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? "Expand space" : "Collapse space"}
          className="relative z-10 flex h-7 w-6 flex-shrink-0 items-center justify-center rounded-lg text-blue-100/65 transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
        <span
          className={cn(
            "relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-base leading-none ring-1",
            isActive
              ? "bg-blue-500/20 ring-blue-300/25 shadow-[0_0_18px_rgba(59,130,246,0.22)]"
              : "bg-white/[0.04] ring-white/10",
          )}
        >
          {sp.icon || "UP"}
        </span>
        <Link
          href={`/spaces/${sp.id}`}
          onClick={onNavigate}
          className={cn(
            "relative z-10 min-w-0 flex-1 rounded-xl px-1.5 py-1.5 text-left text-xs font-semibold truncate outline-none transition-colors",
            isActive
              ? "text-foreground"
              : "text-foreground/90 hover:text-foreground focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        >
          {sp.name}
        </Link>
        {directChildCount > 0 && (
          <span
            className={cn(
              "relative z-10 ml-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
              isActive
                ? "bg-blue-400/16 text-blue-100 ring-1 ring-blue-300/25"
                : "bg-white/[0.06] text-muted-foreground",
            )}
          >
            {directChildCount}
          </span>
        )}
        {canManageWorkspace && (
        <div
          className="relative z-20 flex flex-shrink-0 items-center"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpenId((id) => (id === sp.id ? null : sp.id));
            }}
            aria-label={`Actions for ${sp.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-menu-trigger
            className="relative z-10 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-blue-300/10 bg-[#080d1d]/95 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl"
            >
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(() => null);
                  setCreateListFor({ kind: "space", space: sp });
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5"
              >
                <Plus className="w-3 h-3" /> New list
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(() => null);
                  setCreateFolderTarget({ kind: "space", space: sp });
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5"
              >
                <Folder className="w-3 h-3" /> New folder
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(() => null);
                  setRenameTarget(sp);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5 border-t border-white/5"
              >
                <Pencil className="w-3 h-3" /> Rename
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(() => null);
                  setShareTarget(sp);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5 border-t border-white/5"
              >
                <UserPlus className="w-3 h-3" /> {t("space.shareSpace")}
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(() => null);
                  handleDeleteSpace(sp);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 border-t border-white/5"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="ml-6 mt-1.5 space-y-1 border-l border-blue-300/10 pl-3">
          {spaceFolders.length === 0 && looseLists.length === 0 && (
            <p className={cn(
              "rounded-xl border border-white/5 bg-white/[0.025] px-2 py-1.5 text-[11px] text-muted-foreground/70 italic",
              !isActive && !isSearching && "hidden",
            )}>
              No folders or lists yet
            </p>
          )}
          {visibleFolders.map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              items={projectsByFolder(f.id)}
              collapsed={collapsed}
              toggleCollapse={toggleCollapse}
              menuOpenId={menuOpenId}
              setMenuOpenId={setMenuOpenId}
              pathname={pathname}
              onNavigate={onNavigate}
              canManageWorkspace={canManageWorkspace}
              loadPanel={loadPanel}
              setMoveTarget={setMoveTarget}
              childFoldersByParent={childFoldersByParent}
              projectsByFolder={projectsByFolder}
              isSearching={isSearching}
              setCreateFolderTarget={setCreateFolderTarget}
              setRenameFolderTarget={setRenameFolderTarget}
              setCreateListFor={setCreateListFor}
              handleDeleteFolder={handleDeleteFolder}
            />
          ))}
          {visibleLooseLists.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              href={`/spaces/${sp.id}?tab=browse&list=${p.id}`}
              onMove={() => setMoveTarget(p)}
              onNavigate={onNavigate}
              onDeleted={loadPanel}
              isActive={pathname === `/projects/${p.id}`}
              canManageWorkspace={canManageWorkspace}
            />
          ))}
          {hiddenChildCount > 0 && (
            <Link
              href={`/spaces/${sp.id}?tab=browse`}
              onClick={onNavigate}
              className="block rounded-xl border border-blue-300/10 bg-blue-500/[0.06] px-2 py-1.5 text-[11px] font-medium text-blue-200 hover:bg-blue-500/10"
            >
              View all in space ({hiddenChildCount} more)
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

interface FolderNodeProps {
  folder: FolderT;
  items: Project[];
  childFoldersByParent: (id: string) => FolderT[];
  projectsByFolder: (id: string) => Project[];
  collapsed: Record<string, boolean>;
  toggleCollapse: (id: string) => void;
  menuOpenId: string | null;
  setMenuOpenId: (updater: (id: string | null) => string | null) => void;
  pathname: string;
  onNavigate?: () => void;
  canManageWorkspace: boolean;
  loadPanel: () => void;
  setMoveTarget: (p: Project) => void;
  isSearching: boolean;
  setCreateFolderTarget: (
    v: { kind: "space"; space: Space } | { kind: "folder"; folder: FolderT },
  ) => void;
  setRenameFolderTarget: (f: FolderT) => void;
  setCreateListFor: (
    v: { kind: "space"; space: Space } | { kind: "folder"; folder: FolderT },
  ) => void;
  handleDeleteFolder: (f: FolderT) => void;
}

export function FolderNode({
  folder: f,
  items,
  collapsed,
  toggleCollapse,
  menuOpenId,
  setMenuOpenId,
  pathname,
  onNavigate,
  canManageWorkspace,
  loadPanel,
  setMoveTarget,
  childFoldersByParent,
  projectsByFolder,
  isSearching,
  setCreateFolderTarget,
  setRenameFolderTarget,
  setCreateListFor,
  handleDeleteFolder,
}: FolderNodeProps) {
  const fCollapsed = !!collapsed[f.id];
  const fMenuOpen = menuOpenId === f.id;
  const isActive = pathname === `/folders/${f.id}`;
  const childFolders = childFoldersByParent(f.id);
  const directChildCount = childFolders.length + items.length;
  const visibleChildFolders = isSearching ? childFolders : childFolders.slice(0, MAX_VISIBLE_CHILDREN);
  const remainingItemSlots = isSearching ? items.length : Math.max(0, MAX_VISIBLE_CHILDREN - visibleChildFolders.length);
  const visibleItems = isSearching ? items : items.slice(0, remainingItemSlots);
  const hiddenChildCount = directChildCount - visibleChildFolders.length - visibleItems.length;
  return (
    <div className="rounded-xl">
      <div
        className={cn(
          "group relative flex items-center gap-1 overflow-visible rounded-xl border px-1.5 py-1 transition-all",
          isActive
            ? "border-blue-300/25 bg-blue-500/12 text-foreground shadow-[0_0_20px_rgba(59,130,246,0.16)]"
            : "border-transparent hover:border-blue-300/12 hover:bg-white/[0.045]",
        )}
      >
        {isActive && (
          <span className="pointer-events-none absolute inset-y-1 left-0 w-0.5 rounded-full bg-blue-300 shadow-[0_0_12px_rgba(96,165,250,0.8)]" />
        )}
        <button
          onClick={() => toggleCollapse(f.id)}
          aria-label={fCollapsed ? "Expand" : "Collapse"}
          aria-expanded={!fCollapsed}
          title={fCollapsed ? "Expand folder" : "Collapse folder"}
          className="relative z-10 flex h-6 w-5 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {fCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
        <Link
          href={`/folders/${f.id}`}
          onClick={onNavigate}
          className={cn(
            "relative z-10 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs font-medium outline-none transition-colors",
            isActive
              ? "text-foreground"
              : "text-foreground/85 hover:text-foreground focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        >
          <Folder
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0",
              isActive ? "text-blue-200" : "text-muted-foreground",
            )}
          />
          <span className="truncate">{f.name}</span>
        </Link>
        {fCollapsed && directChildCount > 0 && (
          <span className="relative z-10 ml-1 whitespace-nowrap rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {directChildCount}
          </span>
        )}
        {canManageWorkspace && (
        <div
          className="relative z-20 flex flex-shrink-0 items-center"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpenId((id) => (id === f.id ? null : f.id));
            }}
            aria-label={`Actions for ${f.name}`}
            aria-haspopup="menu"
            aria-expanded={fMenuOpen}
            data-menu-trigger
            className="relative z-10 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
          {fMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-blue-300/10 bg-[#080d1d]/95 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl"
            >
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(() => null);
                  setCreateListFor({ kind: "folder", folder: f });
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5"
              >
                <Plus className="w-3 h-3" /> New list
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(() => null);
                  setCreateFolderTarget({ kind: "folder", folder: f });
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5 border-t border-white/5"
              >
                <Folder className="w-3 h-3" /> New folder
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(() => null);
                  setRenameFolderTarget(f);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5 border-t border-white/5"
              >
                <Pencil className="w-3 h-3" /> Rename
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpenId(() => null);
                  handleDeleteFolder(f);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 border-t border-white/5"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
        )}
      </div>
      {!fCollapsed && (
        <div className="ml-5 mt-1 space-y-1 border-l border-blue-300/10 pl-3">
          {childFolders.length === 0 && items.length === 0 ? (
            <p
              className={cn(
                "rounded-xl border border-white/5 bg-white/[0.025] px-2 py-1 text-[11px] text-muted-foreground/70 italic",
                !isActive && !isSearching && "hidden",
              )}
            >
              No folders or lists yet
            </p>
          ) : (
            <>
              {visibleChildFolders.map((child) => (
                <FolderNode
                  key={child.id}
                  folder={child}
                  items={projectsByFolder(child.id)}
                  childFoldersByParent={childFoldersByParent}
                  projectsByFolder={projectsByFolder}
                  isSearching={isSearching}
                  collapsed={collapsed}
                  toggleCollapse={toggleCollapse}
                  menuOpenId={menuOpenId}
                  setMenuOpenId={setMenuOpenId}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  canManageWorkspace={canManageWorkspace}
                  loadPanel={loadPanel}
                  setMoveTarget={setMoveTarget}
                  setCreateFolderTarget={setCreateFolderTarget}
                  setRenameFolderTarget={setRenameFolderTarget}
                  setCreateListFor={setCreateListFor}
                  handleDeleteFolder={handleDeleteFolder}
                />
              ))}
              {visibleItems.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                href={`/folders/${f.id}?list=${p.id}`}
                onMove={() => setMoveTarget(p)}
                onNavigate={onNavigate}
                onDeleted={loadPanel}
                isActive={pathname === `/projects/${p.id}`}
                canManageWorkspace={canManageWorkspace}
              />
              ))}
              {hiddenChildCount > 0 && (
                <Link
                  href={`/folders/${f.id}`}
                  onClick={onNavigate}
                  className="block rounded-xl border border-blue-300/10 bg-blue-500/[0.06] px-2 py-1.5 text-[11px] font-medium text-blue-200 hover:bg-blue-500/10"
                >
                  View all in folder ({hiddenChildCount} more)
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface UnassignedNodeProps {
  items: Project[];
  collapsed: Record<string, boolean>;
  toggleCollapse: (id: string) => void;
  pathname: string;
  onNavigate?: () => void;
  loadPanel: () => void;
  setMoveTarget: (p: Project) => void;
  isSearching: boolean;
  canManageWorkspace: boolean;
}

export function UnassignedNode({
  items,
  collapsed,
  toggleCollapse,
  pathname,
  onNavigate,
  loadPanel,
  setMoveTarget,
  isSearching,
  canManageWorkspace,
}: UnassignedNodeProps) {
  const id = "__unassigned__";
  const isCollapsed = !!collapsed[id];
  const visibleItems = isSearching ? items : items.slice(0, MAX_VISIBLE_CHILDREN);
  const hiddenCount = items.length - visibleItems.length;
  return (
    <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.025] p-1.5">
      <div className="flex items-center gap-1 rounded-xl px-1 py-1 transition-colors hover:bg-white/[0.045]">
        <button
          onClick={() => toggleCollapse(id)}
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? "Expand unassigned lists" : "Collapse unassigned lists"}
          className="flex h-7 w-6 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
        <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        <button
          onClick={() => toggleCollapse(id)}
          className="min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-left text-xs font-semibold text-muted-foreground truncate transition-colors hover:text-foreground focus:outline-none focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          Unassigned
        </button>
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </div>
      {!isCollapsed && (
        <div className="ml-6 mt-1 space-y-1 border-l border-blue-300/10 pl-3">
          {items.length === 0 ? (
            <p className="rounded-xl border border-white/5 bg-white/[0.025] px-2 py-1.5 text-[11px] text-muted-foreground/70 italic">
              Nothing here
            </p>
          ) : (
            visibleItems.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                onMove={() => setMoveTarget(p)}
                onNavigate={onNavigate}
                onDeleted={loadPanel}
                isActive={pathname === `/projects/${p.id}`}
                canManageWorkspace={canManageWorkspace}
              />
            ))
          )}
          {hiddenCount > 0 && (
            <Link
              href="/projects"
              onClick={onNavigate}
              className="block rounded-xl border border-blue-300/10 bg-blue-500/[0.06] px-2 py-1.5 text-[11px] font-medium text-blue-200 hover:bg-blue-500/10"
            >
              View all lists ({hiddenCount} more)
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
