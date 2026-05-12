"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { cn, formatDate, getInitials, isOverdue } from "@/lib/utils";
import CustomFieldInput from "@/components/projects/custom-field-input";
import type {
  CustomFieldDefinition,
  Task,
  TaskAssignee,
} from "@/lib/types";
import type { GroupBy, ToolbarState } from "@/components/projects/project-toolbar";

interface Props {
  projectId: string;
  tasks: Task[];
  customFields: CustomFieldDefinition[];
  users: TaskAssignee[];
  toolbar: ToolbarState;
  onTaskClick: (task: Task) => void;
  onAddTask: (groupKey?: string) => void;
  onUpdate: () => void;
}

const STATUS_META: Record<string, { label: string; dot: string }> = {
  todo: { label: "To Do", dot: "bg-muted-foreground/60" },
  in_progress: { label: "In Progress", dot: "bg-primary" },
  done: { label: "Done", dot: "bg-upflow-success" },
};
const PRIORITY_META: Record<string, { label: string; dot: string }> = {
  high: { label: "High", dot: "bg-upflow-danger" },
  medium: { label: "Medium", dot: "bg-upflow-warning" },
  low: { label: "Low", dot: "bg-muted-foreground/50" },
};

export default function ListView({
  projectId,
  tasks,
  customFields,
  users,
  toolbar,
  onTaskClick,
  onAddTask,
  onUpdate,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const cols = useMemo(
    () => buildColumns(customFields, toolbar.visibleColumns),
    [customFields, toolbar.visibleColumns],
  );

  const groups = useMemo(
    () => groupTasks(tasks, toolbar, users),
    [tasks, toolbar, users],
  );

  const updateField = async (
    taskId: string,
    definitionId: string,
    value: unknown,
  ) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/custom-fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition_id: definitionId, value }),
      });
      if (!res.ok) throw new Error();
      onUpdate();
    } catch {
      toast.error("Failed to update field");
    }
  };

  const updateTask = async (taskId: string, patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      onUpdate();
    } catch {
      toast.error("Failed to update task");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto max-h-[calc(100vh-280px)] relative">
      <div
        className="grid items-center px-3 py-1.5 border-b border-border bg-card text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 z-20"
        style={{ gridTemplateColumns: cols.gridTemplate }}
      >
        <div className="px-2 sticky left-0 bg-card">Name</div>
        {cols.cols.map((c) => (
          <div key={c.key} className="px-2 truncate">
            {c.label}
          </div>
        ))}
      </div>

      {groups.map((g) => {
        const isCollapsed = collapsed[g.key];
        return (
          <div key={g.key} className="border-b border-border last:border-b-0">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 sticky top-[30px] z-10">
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [g.key]: !p[g.key] }))}
                className="text-muted-foreground hover:text-foreground p-0.5"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded",
                  g.colorClass,
                )}
              >
                {g.label}
              </span>
              <span className="text-xs text-muted-foreground">{g.tasks.length}</span>
              <button
                onClick={() => onAddTask(g.key)}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-muted"
              >
                <Plus className="w-3 h-3" /> Add task
              </button>
            </div>

            {!isCollapsed && (
              <div>
                {g.tasks.length === 0 && (
                  <button
                    onClick={() => onAddTask(g.key)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-5 py-2 w-full text-left"
                  >
                    <Plus className="w-3 h-3" /> Add task
                  </button>
                )}
                {g.tasks.map((t) => {
                  const valueMap = new Map(
                    (t.custom_field_values ?? []).map((v) => [v.definition_id, v.value]),
                  );
                  return (
                    <div
                      key={t.id}
                      className="grid items-center px-3 py-1.5 border-t border-border/60 hover:bg-muted/30 group"
                      style={{ gridTemplateColumns: cols.gridTemplate }}
                    >
                      <div
                        className="px-2 flex items-center gap-2 cursor-pointer min-w-0 sticky left-0 bg-card group-hover:bg-muted/30"
                        onClick={() => onTaskClick(t)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTask(t.id, {
                              status: t.status === "done" ? "todo" : "done",
                            });
                          }}
                          className={cn(
                            "w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center",
                            t.status === "done"
                              ? "bg-upflow-success border-upflow-success"
                              : "border-border hover:border-primary",
                          )}
                          title="Toggle complete"
                        >
                          {t.status === "done" && (
                            <span className="text-[8px] text-white">✓</span>
                          )}
                        </button>
                        <span
                          className={cn(
                            "text-sm text-foreground truncate",
                            t.status === "done" && "line-through text-muted-foreground",
                          )}
                        >
                          {t.title}
                        </span>
                        {isOverdue(t.due_date) && t.status !== "done" && (
                          <AlertCircle className="w-3.5 h-3.5 text-upflow-danger flex-shrink-0" />
                        )}
                        {(t._count?.subtasks ?? 0) > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {t._count?.subtasks} sub
                          </span>
                        )}
                      </div>
                      {cols.cols.map((c) => (
                        <div key={c.key} className="px-2 min-w-0 text-xs text-muted-foreground">
                          {c.kind === "standard" ? (
                            renderStandardCell(c.key, t, users, updateTask)
                          ) : (
                            <CustomFieldInput
                              definition={c.field!}
                              value={valueMap.get(c.field!.id)}
                              users={users}
                              onChange={(v) => updateField(t.id, c.field!.id, v)}
                              compact
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">No tasks</div>
      )}

      <div className="px-3 py-2 border-t border-border">
        <button
          onClick={() => onAddTask()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-3 h-3" /> Add task
        </button>
      </div>
    </div>
  );
}

function renderStandardCell(
  key: string,
  t: Task,
  users: TaskAssignee[],
  updateTask: (id: string, patch: Record<string, unknown>) => void,
) {
  if (key === "assignee") {
    return (
      <select
        value={t.assignee?.id ?? ""}
        onChange={(e) => updateTask(t.id, { assignee_id: e.target.value || null })}
        onClick={(e) => e.stopPropagation()}
        className="bg-transparent text-xs text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded border border-transparent hover:border-border focus:outline-none focus:ring-2 focus:ring-ring max-w-full"
      >
        <option value="">—</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    );
  }
  if (key === "due_date") {
    return (
      <div className="flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        <input
          type="date"
          value={t.due_date ? t.due_date.slice(0, 10) : ""}
          onChange={(e) =>
            updateTask(t.id, { due_date: e.target.value || null })
          }
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "bg-transparent text-xs px-1 py-0.5 rounded border border-transparent hover:border-border focus:outline-none focus:ring-2 focus:ring-ring",
            isOverdue(t.due_date) && t.status !== "done" && "text-upflow-danger",
          )}
        />
      </div>
    );
  }
  if (key === "priority") {
    const meta = PRIORITY_META[t.priority];
    return (
      <select
        value={t.priority}
        onChange={(e) => updateTask(t.id, { priority: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        className="bg-transparent text-xs text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded border border-transparent hover:border-border focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {(["low", "medium", "high"] as const).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>
    );
  }
  if (key === "status") {
    const meta = STATUS_META[t.status];
    return (
      <select
        value={t.status}
        onChange={(e) => updateTask(t.id, { status: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        className="bg-transparent text-xs text-foreground hover:bg-muted/50 px-1.5 py-0.5 rounded border border-transparent hover:border-border focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {Object.entries(STATUS_META).map(([k, m]) => (
          <option key={k} value={k}>
            {m.label}
          </option>
        ))}
      </select>
    );
  }
  return null;
}

interface BuiltCol {
  key: string;
  label: string;
  kind: "standard" | "custom";
  width: string;
  field?: CustomFieldDefinition;
}

function buildColumns(
  customFields: CustomFieldDefinition[],
  visible: Record<string, boolean>,
): { cols: BuiltCol[]; gridTemplate: string } {
  const standards: BuiltCol[] = [
    { key: "assignee", label: "Assignee", kind: "standard", width: "minmax(140px, 0.8fr)" },
    { key: "due_date", label: "Due date", kind: "standard", width: "minmax(140px, 0.8fr)" },
    { key: "priority", label: "Priority", kind: "standard", width: "minmax(110px, 0.6fr)" },
    { key: "status", label: "Status", kind: "standard", width: "minmax(120px, 0.6fr)" },
  ];
  const customs: BuiltCol[] = customFields.map((f) => ({
    key: f.id,
    label: f.name,
    kind: "custom",
    width: "minmax(140px, 1fr)",
    field: f,
  }));
  const all = [...standards, ...customs].filter((c) => visible[c.key] ?? true);
  const gridTemplate = ["minmax(280px, 2fr)", ...all.map((c) => c.width)].join(" ");
  return { cols: all, gridTemplate };
}

interface Group {
  key: string;
  label: string;
  colorClass: string;
  tasks: Task[];
}

function groupTasks(tasks: Task[], toolbar: ToolbarState, users: TaskAssignee[]): Group[] {
  let filtered = tasks;
  if (toolbar.search.trim()) {
    const q = toolbar.search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q),
    );
  }
  if (!toolbar.showClosed) {
    filtered = filtered.filter((t) => t.status !== "done");
  }
  if (toolbar.filterPriority !== "all") {
    filtered = filtered.filter((t) => t.priority === toolbar.filterPriority);
  }
  if (toolbar.filterAssignee !== "all") {
    const allowed = new Set(users.map((u) => u.id));
    if (toolbar.filterAssignee === "unassigned") {
      filtered = filtered.filter((t) => !t.assignee);
    } else if (allowed.has(toolbar.filterAssignee)) {
      filtered = filtered.filter((t) => t.assignee?.id === toolbar.filterAssignee);
    } else {
      filtered = filtered.filter((t) => t.assignee?.id === toolbar.filterAssignee);
    }
  }

  const sorted = [...filtered].sort((a, b) => compareTasks(a, b, toolbar));

  const buckets: Group[] = [];
  const push = (key: string, label: string, colorClass: string, t: Task) => {
    let g = buckets.find((x) => x.key === key);
    if (!g) {
      g = { key, label, colorClass, tasks: [] };
      buckets.push(g);
    }
    g.tasks.push(t);
  };

  if (toolbar.groupBy === "status") {
    (["todo", "in_progress", "done"] as const).forEach((s) => {
      buckets.push({
        key: s,
        label: STATUS_META[s].label,
        colorClass: pillFor("status", s),
        tasks: [],
      });
    });
    sorted.forEach((t) => {
      const g = buckets.find((b) => b.key === t.status);
      if (g) g.tasks.push(t);
    });
  } else if (toolbar.groupBy === "priority") {
    (["high", "medium", "low"] as const).forEach((p) => {
      buckets.push({
        key: p,
        label: PRIORITY_META[p].label,
        colorClass: pillFor("priority", p),
        tasks: [],
      });
    });
    sorted.forEach((t) => {
      const g = buckets.find((b) => b.key === t.priority);
      if (g) g.tasks.push(t);
    });
  } else if (toolbar.groupBy === "assignee") {
    sorted.forEach((t) => {
      const key = t.assignee?.id ?? "_unassigned";
      const label = t.assignee?.name ?? "Unassigned";
      push(key, label, "bg-muted text-muted-foreground", t);
    });
  } else {
    buckets.push({
      key: "all",
      label: "All tasks",
      colorClass: "bg-muted text-muted-foreground",
      tasks: sorted,
    });
  }

  return buckets.filter((b) => b.tasks.length > 0 || toolbar.groupBy === "status");
}

function pillFor(kind: "status" | "priority", key: string) {
  if (kind === "status") {
    if (key === "todo") return "bg-muted text-foreground";
    if (key === "in_progress") return "bg-primary/15 text-primary";
    if (key === "done") return "bg-upflow-success/15 text-upflow-success";
  }
  if (kind === "priority") {
    if (key === "high") return "bg-upflow-danger/15 text-upflow-danger";
    if (key === "medium") return "bg-upflow-warning/15 text-upflow-warning";
    if (key === "low") return "bg-muted text-muted-foreground";
  }
  return "bg-muted text-muted-foreground";
}

function compareTasks(a: Task, b: Task, toolbar: ToolbarState): number {
  const dir = toolbar.sortDir === "asc" ? 1 : -1;
  const PRIO_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  switch (toolbar.sortBy) {
    case "title":
      return a.title.localeCompare(b.title) * dir;
    case "due_date": {
      const av = a.due_date ? Date.parse(a.due_date) : Infinity;
      const bv = b.due_date ? Date.parse(b.due_date) : Infinity;
      return (av - bv) * dir;
    }
    case "priority":
      return (PRIO_RANK[a.priority] - PRIO_RANK[b.priority]) * dir;
    case "created_at":
      return (Date.parse(a.created_at) - Date.parse(b.created_at)) * dir;
    case "position":
    default:
      return (a.position - b.position) * dir;
  }
}
