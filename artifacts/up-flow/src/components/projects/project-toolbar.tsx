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
import { useLanguage } from "@/components/language-provider";
import type { CustomFieldDefinition } from "@/lib/types";

export type GroupBy = "status" | "assignee" | "priority" | "none";
export type SortBy = "position" | "due_date" | "priority" | "title" | "created_at";

export type FilterPriority = "all" | "high" | "medium" | "low";
export type FilterAssignee = "all" | "unassigned" | "me" | string;

export interface ToolbarState {
  view: "list" | "board";
  search: string;
  groupBy: GroupBy;
  sortBy: SortBy;
  sortDir: "asc" | "desc";
  showClosed: boolean;
  visibleColumns: Record<string, boolean>;
  filterPriority: FilterPriority;
  filterAssignee: FilterAssignee;
}

interface Props {
  state: ToolbarState;
  onChange: (next: ToolbarState) => void;
  customFields: CustomFieldDefinition[];
  onManageFields?: () => void;
  canManage: boolean;
  users?: { id: string; name: string }[];
}

export default function ProjectToolbar({
  state,
  onChange,
  customFields,
  onManageFields,
  canManage,
  users = [],
}: Props) {
  const { t } = useLanguage();
  const filterCount =
    (state.filterPriority !== "all" ? 1 : 0) +
    (state.filterAssignee !== "all" ? 1 : 0);
  const set = (patch: Partial<ToolbarState>) => onChange({ ...state, ...patch });

  const standardColumns = [
    { key: "assignee", label: t("toolbar.assignee") },
    { key: "due_date", label: t("toolbar.dueDate") },
    { key: "priority", label: t("toolbar.priority") },
    { key: "status", label: t("toolbar.status") },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap py-2 border-b border-border mb-3">
      <div className="flex items-center bg-card border border-border rounded-md p-0.5 mr-1">
        <ToolbarTab
          active={state.view === "list"}
          onClick={() => set({ view: "list" })}
          icon={<LayoutList className="w-3.5 h-3.5" />}
          label={t("toolbar.list")}
        />
        <ToolbarTab
          active={state.view === "board"}
          onClick={() => set({ view: "board" })}
          icon={<Columns3 className="w-3.5 h-3.5" />}
          label={t("toolbar.board")}
        />
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={state.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder={t("toolbar.searchTasks")}
          className="pl-8 pr-3 py-1.5 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-52"
        />
      </div>

      <FilterPopover
        state={state}
        onChange={(p) => set(p)}
        users={users}
        count={filterCount}
      />

      <DropdownButton
        icon={<Filter className="w-3.5 h-3.5" />}
        label={t("toolbar.group", { label: groupLabel(state.groupBy, t) })}
        items={[
          { label: t("toolbar.status"), value: "status" },
          { label: t("toolbar.assignee"), value: "assignee" },
          { label: t("toolbar.priority"), value: "priority" },
          { label: t("common.none"), value: "none" },
        ]}
        active={state.groupBy}
        onPick={(v) => set({ groupBy: v as GroupBy })}
      />

      <DropdownButton
        icon={<ArrowUpDown className="w-3.5 h-3.5" />}
        label={t("toolbar.sort", { label: sortLabel(state.sortBy, t) })}
        items={[
          { label: t("toolbar.manual"), value: "position" },
          { label: t("toolbar.dueDate"), value: "due_date" },
          { label: t("toolbar.priority"), value: "priority" },
          { label: t("toolbar.title"), value: "title" },
          { label: t("toolbar.created"), value: "created_at" },
        ]}
        active={state.sortBy}
        onPick={(v) => set({ sortBy: v as SortBy })}
      />

      <button
        onClick={() => set({ sortDir: state.sortDir === "asc" ? "desc" : "asc" })}
        className="text-xs px-2 py-1.5 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        title={state.sortDir === "asc" ? t("toolbar.sortAscending") : t("toolbar.sortDescending")}
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
        {t("toolbar.showClosed")}
      </button>

      <ColumnsDropdown
        columns={[
          ...standardColumns,
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
          <Settings2 className="w-3.5 h-3.5" /> {t("toolbar.customFields")}
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
  const { t } = useLanguage();
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
        {t("toolbar.columns")}
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

function FilterPopover({
  state,
  onChange,
  users,
  count,
}: {
  state: ToolbarState;
  onChange: (patch: Partial<ToolbarState>) => void;
  users: { id: string; name: string }[];
  count: number;
}) {
  const { t } = useLanguage();
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
        className={cn(
          "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border",
          count > 0
            ? "bg-primary/15 border-primary/40 text-primary"
            : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted",
        )}
      >
        <Filter className="w-3.5 h-3.5" />
        {t("toolbar.filter")}
        {count > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full px-1">
            {count}
          </span>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 min-w-[240px] bg-popover border border-border rounded-lg shadow-xl p-3 space-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {t("toolbar.priority")}
            </div>
            <div className="flex flex-wrap gap-1">
              {(["all", "high", "medium", "low"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => onChange({ filterPriority: p })}
                  className={cn(
                    "text-xs px-2 py-1 rounded-md border capitalize",
                    state.filterPriority === p
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {priorityFilterLabel(p, t)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {t("toolbar.assignee")}
            </div>
            <select
              value={state.filterAssignee}
              onChange={(e) =>
                onChange({ filterAssignee: e.target.value as FilterAssignee })
              }
              className="w-full text-xs bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">{t("common.anyone")}</option>
              <option value="unassigned">{t("common.unassigned")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          {count > 0 && (
            <button
              onClick={() =>
                onChange({ filterPriority: "all", filterAssignee: "all" })
              }
              className="w-full text-xs text-muted-foreground hover:text-foreground border-t border-border pt-2"
            >
              {t("toolbar.clearFilters")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function groupLabel(
  g: GroupBy,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (g === "none") return t("common.none");
  if (g === "status") return t("toolbar.status");
  if (g === "assignee") return t("toolbar.assignee");
  return t("toolbar.priority");
}
function sortLabel(
  s: SortBy,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (s === "position") return t("toolbar.manual");
  if (s === "due_date") return t("toolbar.dueDate");
  if (s === "created_at") return t("toolbar.created");
  if (s === "title") return t("toolbar.title");
  return t("toolbar.priority");
}

function priorityFilterLabel(
  priority: FilterPriority,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (priority === "all") return t("common.anyone");
  if (priority === "high") return t("priority.high");
  if (priority === "medium") return t("priority.medium");
  return t("priority.low");
}
