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
  setCreateFolderForSpace: (s: Space) => void;
  setRenameFolderTarget: (f: FolderT) => void;
  setCreateListFor: (
    v: { kind: "space"; space: Space } | { kind: "folder"; folder: FolderT },
  ) => void;
  handleDeleteSpace: (s: Space) => void;
  handleDeleteFolder: (f: FolderT) => void;
}

interface SpaceNodeProps extends NodeHandlers {
  space: Space;
  folders: FolderT[];
  looseLists: Project[];
  foldersBySpace: FolderT[];
  totalCount: number;
  projectsByFolder: (id: string) => Project[];
}

export function SpaceNode({
  space: sp,
  looseLists,
  foldersBySpace: spaceFolders,
  totalCount,
  projectsByFolder,
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
}: SpaceNodeProps) {
  const isCollapsed = !!collapsed[sp.id];
  const menuOpen = menuOpenId === sp.id;
  const isActive = pathname === `/spaces/${sp.id}`;
  return (
    <div className="rounded-lg">
      <div
        className={cn(
          "group relative flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-white/5",
          isActive && "bg-primary/15",
        )}
      >
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
        <Link
          href={`/spaces/${sp.id}`}
          onClick={onNavigate}
          className={cn(
            "flex-1 text-left text-xs font-semibold truncate",
            isActive ? "text-foreground" : "text-foreground hover:text-foreground",
          )}
        >
          {sp.name}
        </Link>
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
                  setCreateFolderForSpace(sp);
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
      </div>

      {!isCollapsed && (
        <div className="ml-5 pl-2 border-l border-white/5 space-y-0.5 mt-0.5">
          {spaceFolders.length === 0 && looseLists.length === 0 && (
            <p className="px-2 py-1.5 text-[11px] text-muted-foreground/70 italic">
              No folders or lists yet
            </p>
          )}
          {spaceFolders.map((f) => (
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
              setRenameFolderTarget={setRenameFolderTarget}
              setCreateListFor={setCreateListFor}
              handleDeleteFolder={handleDeleteFolder}
            />
          ))}
          {looseLists.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              onMove={() => setMoveTarget(p)}
              onNavigate={onNavigate}
              onDeleted={loadPanel}
              isActive={pathname === `/projects/${p.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FolderNodeProps {
  folder: FolderT;
  items: Project[];
  collapsed: Record<string, boolean>;
  toggleCollapse: (id: string) => void;
  menuOpenId: string | null;
  setMenuOpenId: (updater: (id: string | null) => string | null) => void;
  pathname: string;
  onNavigate?: () => void;
  loadPanel: () => void;
  setMoveTarget: (p: Project) => void;
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
  setRenameFolderTarget,
  setCreateListFor,
  handleDeleteFolder,
}: FolderNodeProps) {
  const fCollapsed = !!collapsed[f.id];
  const fMenuOpen = menuOpenId === f.id;
  return (
    <div className="rounded-md">
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
          {items.length}
        </span>
        <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpenId((id) => (id === f.id ? null : f.id))}
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
      </div>
      {!fCollapsed && (
        <div className="ml-4 pl-2 border-l border-white/5 space-y-0.5 mt-0.5">
          {items.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-muted-foreground/70 italic">
              No lists yet
            </p>
          ) : (
            items.map((p) => (
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
}

export function UnassignedNode({
  items,
  collapsed,
  toggleCollapse,
  pathname,
  onNavigate,
  loadPanel,
  setMoveTarget,
}: UnassignedNodeProps) {
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
                onNavigate={onNavigate}
                onDeleted={loadPanel}
                isActive={pathname === `/projects/${p.id}`}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
