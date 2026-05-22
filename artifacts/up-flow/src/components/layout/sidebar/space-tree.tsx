"use client";

import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Project, Space, Folder as FolderT } from "@/lib/types";
import { ProjectRow } from "@/components/layout/sidebar/project-row";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_CHILDREN = 8;

export interface NodeHandlers {
  collapsed: Record<string, boolean>;
  toggleCollapse: (id: string) => void;
  menuOpenId: string | null;
  setMenuOpenId: (updater: (id: string | null) => string | null) => void;
  pathname: string;
  onNavigate?: () => void;
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
  loadPanel,
  setMoveTarget,
  setRenameTarget,
  setCreateFolderTarget,
  setRenameFolderTarget,
  setCreateListFor,
  handleDeleteSpace,
  handleDeleteFolder,
}: SpaceNodeProps) {
  const isCollapsed = !!collapsed[sp.id];
  const menuOpen = menuOpenId === sp.id;
  const isActive = pathname === `/spaces/${sp.id}`;
  const directChildCount = spaceFolders.length + looseLists.length;
  const visibleFolders = isSearching ? spaceFolders : spaceFolders.slice(0, MAX_VISIBLE_CHILDREN);
  const remainingListSlots = isSearching ? looseLists.length : Math.max(0, MAX_VISIBLE_CHILDREN - visibleFolders.length);
  const visibleLooseLists = isSearching ? looseLists : looseLists.slice(0, remainingListSlots);
  const hiddenChildCount = directChildCount - visibleFolders.length - visibleLooseLists.length;
  return (
    <div className="rounded-lg">
      <div
        className={cn(
          "group relative flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-white/5",
          isActive && "bg-primary/15",
        )}
      >
        <button
          onClick={() => toggleCollapse(sp.id)}
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? "Expand space" : "Collapse space"}
          className="flex h-7 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
        <span className="text-base leading-none">{sp.icon || "🗂️"}</span>
        <Link
          href={`/spaces/${sp.id}`}
          onClick={onNavigate}
          className={cn(
            "flex-1 rounded-md px-1.5 py-1.5 text-left text-xs font-semibold truncate outline-none transition-colors",
            isActive
              ? "text-foreground"
              : "text-foreground/90 hover:text-foreground focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        >
          {sp.name}
        </Link>
        <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() =>
              setMenuOpenId((id) => (id === sp.id ? null : sp.id))
            }
            aria-label={`Actions for ${sp.name}`}
            aria-expanded={menuOpen}
            data-menu-trigger
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
                  handleDeleteSpace(sp);
                }}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 border-t border-white/5"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
        {isCollapsed && directChildCount > 0 && (
          <span className="ml-1 whitespace-nowrap text-[10px] text-muted-foreground">
            {spaceFolders.length} folders · {looseLists.length} lists
          </span>
        )}
      </div>

      {!isCollapsed && (
        <div className="ml-5 pl-2 border-l border-white/5 space-y-0.5 mt-0.5">
          {spaceFolders.length === 0 && looseLists.length === 0 && (
            <p className={cn(
              "px-2 py-1.5 text-[11px] text-muted-foreground/70 italic",
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
              onMove={() => setMoveTarget(p)}
              onNavigate={onNavigate}
              onDeleted={loadPanel}
              isActive={pathname === `/projects/${p.id}`}
            />
          ))}
          {hiddenChildCount > 0 && (
            <Link
              href={`/spaces/${sp.id}?tab=browse`}
              onClick={onNavigate}
              className="block rounded-md px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10"
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
    <div className="rounded-md">
      <div
        className={cn(
          "group relative flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-white/5",
          isActive && "bg-primary/15",
        )}
      >
        <button
          onClick={() => toggleCollapse(f.id)}
          aria-label={fCollapsed ? "Expand" : "Collapse"}
          aria-expanded={!fCollapsed}
          title={fCollapsed ? "Expand folder" : "Collapse folder"}
          className="flex h-6 w-5 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs font-medium outline-none transition-colors",
            isActive
              ? "text-foreground"
              : "text-foreground/85 hover:text-foreground focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        >
          <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">{f.name}</span>
        </Link>
        <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpenId((id) => (id === f.id ? null : f.id))}
            aria-label={`Actions for ${f.name}`}
            aria-expanded={fMenuOpen}
            data-menu-trigger
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
        {fCollapsed && directChildCount > 0 && (
          <span className="ml-1 whitespace-nowrap text-[10px] text-muted-foreground">
            {childFolders.length} folders · {items.length} lists
          </span>
        )}
      </div>
      {!fCollapsed && (
        <div className="ml-4 pl-2 border-l border-white/5 space-y-0.5 mt-0.5">
          {childFolders.length === 0 && items.length === 0 ? (
            <p
              className={cn(
                "px-2 py-1 text-[11px] text-muted-foreground/70 italic",
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
                onMove={() => setMoveTarget(p)}
                onNavigate={onNavigate}
                onDeleted={loadPanel}
                isActive={pathname === `/projects/${p.id}`}
              />
              ))}
              {hiddenChildCount > 0 && (
                <Link
                  href={`/folders/${f.id}`}
                  onClick={onNavigate}
                  className="block rounded-md px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10"
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
}: UnassignedNodeProps) {
  const id = "__unassigned__";
  const isCollapsed = !!collapsed[id];
  const visibleItems = isSearching ? items : items.slice(0, MAX_VISIBLE_CHILDREN);
  const hiddenCount = items.length - visibleItems.length;
  return (
    <div className="rounded-lg pt-2 mt-2 border-t border-white/5">
      <div className="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-white/5">
        <button
          onClick={() => toggleCollapse(id)}
          aria-label={isCollapsed ? "Expand" : "Collapse"}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? "Expand unassigned lists" : "Collapse unassigned lists"}
          className="flex h-7 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
          className="min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-left text-xs font-semibold text-muted-foreground truncate transition-colors hover:text-foreground focus:outline-none focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary/60"
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
            visibleItems.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                onMove={() => setMoveTarget(p)}
                onNavigate={onNavigate}
                onDeleted={loadPanel}
                isActive={pathname === `/projects/${p.id}`}
              />
            ))
          )}
          {hiddenCount > 0 && (
            <Link
              href="/projects"
              onClick={onNavigate}
              className="block rounded-md px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10"
            >
              View all lists ({hiddenCount} more)
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
