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
  Check,
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
    <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-blue-300/10 py-3">
      <div className="mr-1 flex items-center rounded-xl border border-blue-300/10 bg-[#071024]/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
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
          className="w-56 rounded-xl border border-blue-300/10 bg-[#071024]/80 py-2 pl-9 pr-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-400/40"
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
        className="rounded-xl border border-blue-300/10 bg-[#071024]/80 px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-sky-400/30 hover:bg-sky-400/10 hover:text-foreground"
        title={state.sortDir === "asc" ? t("toolbar.sortAscending") : t("toolbar.sortDescending")}
      >
        {state.sortDir === "asc" ? "↑" : "↓"}
      </button>

      <button
        onClick={() => set({ showClosed: !state.showClosed })}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
          state.showClosed
            ? "border-sky-400/45 bg-sky-400/15 text-sky-200 shadow-[0_0_18px_rgba(59,130,246,0.16)]"
            : "border-blue-300/10 bg-[#071024]/80 text-muted-foreground hover:border-sky-400/30 hover:bg-sky-400/10 hover:text-foreground",
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
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-blue-300/10 bg-[#071024]/80 px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-sky-400/30 hover:bg-sky-400/10 hover:text-foreground"
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
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
        active
          ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_0_24px_rgba(59,130,246,0.32)]"
          : "text-muted-foreground hover:bg-white/10 hover:text-foreground",
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
        className="flex items-center gap-1.5 rounded-xl border border-blue-300/10 bg-[#071024]/80 px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-sky-400/30 hover:bg-sky-400/10 hover:text-foreground"
      >
        {icon}
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 min-w-[170px] rounded-xl border border-blue-300/10 bg-[#071024] p-1 shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
          {items.map((it) => (
            <button
              key={it.value}
              onClick={() => {
                onPick(it.value);
                setOpen(false);
              }}
              className={cn(
                "w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-sky-400/10",
                active === it.value ? "text-sky-200" : "text-foreground",
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
        className="flex items-center gap-1.5 rounded-xl border border-blue-300/10 bg-[#071024]/80 px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-sky-400/30 hover:bg-sky-400/10 hover:text-foreground"
      >
        <Eye className="w-3.5 h-3.5" />
        {t("toolbar.columns")}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 max-h-72 min-w-[220px] overflow-y-auto rounded-xl border border-blue-300/10 bg-[#071024] p-1 shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
          {columns.map((c) => {
            const on = visible[c.key] ?? true;
            return (
              <button
                key={c.key}
                onClick={() => onToggle(c.key)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-sky-400/10"
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 items-center justify-center rounded border",
                    on ? "border-sky-400 bg-sky-500" : "border-white/15",
                  )}
                >
                  {on && <Check className="h-2.5 w-2.5 text-white" />}
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
          "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
          count > 0
            ? "border-sky-400/45 bg-sky-400/15 text-sky-200 shadow-[0_0_18px_rgba(59,130,246,0.16)]"
            : "border-blue-300/10 bg-[#071024]/80 text-muted-foreground hover:border-sky-400/30 hover:bg-sky-400/10 hover:text-foreground",
        )}
      >
        <Filter className="w-3.5 h-3.5" />
        {t("toolbar.filter")}
        {count > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-2 min-w-[260px] space-y-3 rounded-xl border border-blue-300/10 bg-[#071024] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
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
                    "rounded-lg border px-2 py-1 text-xs capitalize transition-colors",
                    state.filterPriority === p
                      ? "border-sky-400/45 bg-sky-400/15 text-sky-200"
                      : "border-white/10 text-muted-foreground hover:bg-sky-400/10",
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
              className="w-full rounded-lg border border-white/10 bg-[#050a18] px-2 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-sky-400/40"
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
