"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Eye,
  Settings2,
  LayoutList,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomFieldDefinition } from "@/lib/types";

export type GroupBy = "status" | "assignee" | "priority" | "none";
export type SortBy = "position" | "due_date" | "priority" | "title" | "created_at";

export interface ToolbarState {
  view: "list" | "board";
  search: string;
  groupBy: GroupBy;
  sortBy: SortBy;
  sortDir: "asc" | "desc";
  showClosed: boolean;
  visibleColumns: Record<string, boolean>;
}

interface Props {
  state: ToolbarState;
  onChange: (next: ToolbarState) => void;
  customFields: CustomFieldDefinition[];
  onManageFields?: () => void;
  canManage: boolean;
}

const STANDARD_COLUMNS = [
  { key: "assignee", label: "Assignee" },
  { key: "due_date", label: "Due date" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
];

export default function ProjectToolbar({
  state,
  onChange,
  customFields,
  onManageFields,
  canManage,
}: Props) {
  const set = (patch: Partial<ToolbarState>) => onChange({ ...state, ...patch });

  return (
    <div className="flex items-center gap-1.5 flex-wrap py-2 border-b border-border mb-3">
      <div className="flex items-center bg-card border border-border rounded-md p-0.5 mr-1">
        <ToolbarTab
          active={state.view === "list"}
          onClick={() => set({ view: "list" })}
          icon={<LayoutList className="w-3.5 h-3.5" />}
          label="List"
        />
        <ToolbarTab
          active={state.view === "board"}
          onClick={() => set({ view: "board" })}
          icon={<Columns3 className="w-3.5 h-3.5" />}
          label="Board"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={state.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search tasks..."
          className="pl-8 pr-3 py-1.5 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-52"
        />
      </div>

      <DropdownButton
        icon={<Filter className="w-3.5 h-3.5" />}
        label={`Group: ${groupLabel(state.groupBy)}`}
        items={[
          { label: "Status", value: "status" },
          { label: "Assignee", value: "assignee" },
          { label: "Priority", value: "priority" },
          { label: "None", value: "none" },
        ]}
        active={state.groupBy}
        onPick={(v) => set({ groupBy: v as GroupBy })}
      />

      <DropdownButton
        icon={<ArrowUpDown className="w-3.5 h-3.5" />}
        label={`Sort: ${sortLabel(state.sortBy)}`}
        items={[
          { label: "Manual", value: "position" },
          { label: "Due date", value: "due_date" },
          { label: "Priority", value: "priority" },
          { label: "Title", value: "title" },
          { label: "Created", value: "created_at" },
        ]}
        active={state.sortBy}
        onPick={(v) => set({ sortBy: v as SortBy })}
      />

      <button
        onClick={() => set({ sortDir: state.sortDir === "asc" ? "desc" : "asc" })}
        className="text-xs px-2 py-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        title={`Sort ${state.sortDir === "asc" ? "ascending" : "descending"}`}
      >
        {state.sortDir === "asc" ? "↑" : "↓"}
      </button>

      <button
        onClick={() => set({ showClosed: !state.showClosed })}
        className={cn(
          "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border",
          state.showClosed
            ? "bg-primary/15 border-primary/40 text-primary"
            : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted",
        )}
      >
        Show closed
      </button>

      <ColumnsDropdown
        columns={[
          ...STANDARD_COLUMNS,
          ...customFields.map((f) => ({ key: f.id, label: f.name })),
        ]}
        visible={state.visibleColumns}
        onToggle={(key) =>
          set({
            visibleColumns: {
              ...state.visibleColumns,
              [key]: !(state.visibleColumns[key] ?? true),
            },
          })
        }
      />

      {canManage && onManageFields && (
        <button
          onClick={onManageFields}
          className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Settings2 className="w-3.5 h-3.5" /> Custom fields
        </button>
      )}
    </div>
  );
}

function ToolbarTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-[5px] font-medium transition-colors",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function DropdownButton({
  icon,
  label,
  items,
  active,
  onPick,
}: {
  icon: React.ReactNode;
  label: string;
  items: { label: string; value: string }[];
  active: string;
  onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        {icon}
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 min-w-[160px] bg-popover border border-border rounded-lg shadow-xl p-1">
          {items.map((it) => (
            <button
              key={it.value}
              onClick={() => {
                onPick(it.value);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-muted",
                active === it.value ? "text-primary" : "text-foreground",
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ColumnsDropdown({
  columns,
  visible,
  onToggle,
}: {
  columns: { key: string; label: string }[];
  visible: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <Eye className="w-3.5 h-3.5" />
        Columns
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 min-w-[200px] bg-popover border border-border rounded-lg shadow-xl p-1 max-h-72 overflow-y-auto">
          {columns.map((c) => {
            const on = visible[c.key] ?? true;
            return (
              <button
                key={c.key}
                onClick={() => onToggle(c.key)}
                className="w-full flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-md text-foreground hover:bg-muted"
              >
                <span
                  className={cn(
                    "w-3.5 h-3.5 rounded border flex items-center justify-center",
                    on ? "bg-primary border-primary" : "border-border",
                  )}
                >
                  {on && <span className="text-[9px] text-primary-foreground">✓</span>}
                </span>
                <span className="truncate">{c.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function groupLabel(g: GroupBy) {
  return g === "none" ? "None" : g.charAt(0).toUpperCase() + g.slice(1);
}
function sortLabel(s: SortBy) {
  if (s === "position") return "Manual";
  if (s === "due_date") return "Due date";
  if (s === "created_at") return "Created";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
