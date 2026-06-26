"use client";

import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { Plus, Calendar, AlertCircle, MessageSquare, Trash2, MoreHorizontal } from "lucide-react";
import { cn, formatDate, getInitials, isOverdue } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import TaskDetailSheet from "@/components/projects/task-detail-sheet";
import CustomFieldChip from "@/components/projects/custom-field-chip";
import type { CustomFieldDefinition, Task, TaskAssignee } from "@/lib/types";
import type { ToolbarState } from "@/components/projects/project-toolbar";

interface KanbanBoardProps {
  projectId: string;
  tasks: Task[];
  customFields: CustomFieldDefinition[];
  users: TaskAssignee[];
  toolbar?: ToolbarState;
  onUpdate: () => void;
  onAddTask: (status: ColumnKey) => void;
}

const COLUMNS = [
  { key: "todo", label: "To Do", color: "bg-muted-foreground/60", hex: "rgb(115 115 115)" },
  { key: "in_progress", label: "In Progress", color: "bg-primary", hex: "rgb(126 167 255)" },
  { key: "done", label: "Done", color: "bg-upflow-success", hex: "rgb(74 222 128)" },
] as const;

export type ColumnKey = "todo" | "in_progress" | "done";

function columnLabel(
  key: ColumnKey,
  fallback: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (key === "todo") return t("status.todo");
  if (key === "in_progress") return t("status.inProgress");
  if (key === "done") return t("status.done");
  return fallback;
}

function priorityLabel(
  priority: Task["priority"],
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (priority === "high") return t("priority.high");
  if (priority === "medium") return t("priority.medium");
  return t("priority.low");
}

export default function KanbanBoard({
  projectId,
  tasks,
  customFields,
  users,
  toolbar,
  onUpdate,
  onAddTask,
}: KanbanBoardProps) {
  const { t } = useLanguage();
  const [columns, setColumns] = useState<Record<ColumnKey, Task[]>>({
    todo: [],
    in_progress: [],
    done: [],
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const grouped: Record<ColumnKey, Task[]> = { todo: [], in_progress: [], done: [] };
    let filtered = tasks;
    if (toolbar) {
      if (toolbar.search.trim()) {
        const q = toolbar.search.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.description ?? "").toLowerCase().includes(q),
        );
      }
      if (toolbar.filterPriority !== "all") {
        filtered = filtered.filter((t) => t.priority === toolbar.filterPriority);
      }
      if (!toolbar.showClosed) {
        filtered = filtered.filter((t) => t.status !== "done");
      }
      if (toolbar.filterAssignee !== "all") {
        if (toolbar.filterAssignee === "unassigned") {
          filtered = filtered.filter((t) => !t.assignee);
        } else {
          filtered = filtered.filter((t) => t.assignee?.id === toolbar.filterAssignee);
        }
      }
    }
    filtered.forEach((t) => {
      if (t.status in grouped) {
        grouped[t.status as ColumnKey].push(t);
      }
    });
    Object.keys(grouped).forEach((k) => {
      grouped[k as ColumnKey].sort((a, b) => a.position - b.position);
    });
    setColumns(grouped);
  }, [tasks, toolbar]);

  const deleteTask = async (taskId: string) => {
    if (!confirm(t("task.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? t("task.failedDelete"));
      }
      onUpdate();
      toast.success(t("dashboard.taskDeleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("task.failedDelete"));
    }
  };

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const visibleCustomFields = customFields.filter(
    (f) => toolbar?.visibleColumns?.[f.id] ?? true,
  );

  const handleDragEnd = async (result: DropResult) => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index)
      return;

    const srcCol = source.droppableId as ColumnKey;
    const dstCol = destination.droppableId as ColumnKey;

    const newColumns = { ...columns };
    const srcItems = [...newColumns[srcCol]];
    const [removed] = srcItems.splice(source.index, 1);
    newColumns[srcCol] = srcItems;

    const dstItems = srcCol === dstCol ? srcItems : [...newColumns[dstCol]];
    dstItems.splice(destination.index, 0, { ...removed, status: dstCol });
    newColumns[dstCol] = dstItems;

    setColumns(newColumns);

    try {
      const res = await fetch(`/api/projects/${projectId}/reorder-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movedTaskId: draggableId,
          srcColumn: srcCol,
          dstColumn: dstCol,
          dstIndex: destination.index,
        }),
      });
      if (!res.ok) throw new Error(`Reorder failed: ${res.status}`);
    } catch {
      toast.error("Failed to update task");
      onUpdate();
    }
  };

  return (
    <>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex h-[calc(100dvh-300px)] min-h-[440px] max-w-full gap-4 overflow-x-auto overscroll-x-contain pb-5 sm:h-[calc(100dvh-280px)]">
          {COLUMNS.map(({ key, label, color, hex }) => (
            <Droppable key={key} droppableId={key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "upflow-kanban-column flex h-full w-[min(88vw,380px)] flex-shrink-0 flex-col overflow-hidden rounded-2xl transition-all sm:w-[360px] xl:w-[380px]",
                    snapshot.isDraggingOver && "border-sky-400/50 shadow-[0_0_36px_rgba(59,130,246,0.22)] ring-1 ring-sky-400/30",
                  )}
                >
                  <div
                    className="flex items-center gap-2 border-t-2 px-4 py-3"
                    style={{ borderColor: hex }}
                  >
                    <div className={cn("h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]", color)} />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      {columnLabel(key, label, t)}
                    </span>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {columns[key].length}
                    </span>
                    <button
                      onClick={() => onAddTask(key)}
                      className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground"
                      title={t("projects.addTask")}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                    {columns[key].map((task, index) => {
                      const valueMap = new Map(
                        (task.custom_field_values ?? []).map((v) => [v.definition_id, v.value]),
                      );
                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => {
                            const { style: draggableStyle, ...draggableProps } =
                              provided.draggableProps;

                            return (
                            <div
                              ref={provided.innerRef}
                              {...draggableProps}
                              {...provided.dragHandleProps}
                              style={draggableStyle as CSSProperties | undefined}
                              onClick={() => {
                                if (isDraggingRef.current) return;
                                setSelectedTask(task);
                              }}
                              className={cn(
                                "upflow-task-card group relative cursor-pointer rounded-xl p-3 transition-all hover:-translate-y-0.5",
                                snapshot.isDragging && "rotate-1 opacity-95 shadow-[0_24px_60px_rgba(59,130,246,0.24)]",
                              )}
                            >
                              <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#071024]/95 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTask(task);
                                  }}
                                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                                  title={t("common.open")}
                                >
                                  <MoreHorizontal className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTask(task.id);
                                  }}
                                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                                  title={t("common.delete")}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              {task.cover_image_url && (
                                <div className="-mx-3 -mt-3 mb-3 overflow-hidden rounded-t-xl border-b border-white/10 bg-muted/30">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={task.cover_image_url}
                                    alt=""
                                    className="aspect-video w-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                              <div className="flex items-start gap-1.5">
                                <span
                                  className={cn(
                                    "mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-[0_0_12px_currentColor]",
                                    task.priority === "high"
                                      ? "bg-upflow-danger"
                                      : task.priority === "medium"
                                        ? "bg-upflow-warning"
                                        : "bg-muted-foreground/50",
                                  )}
                                  title={`${t("toolbar.priority")}: ${priorityLabel(task.priority, t)}`}
                                />
                                <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-foreground">
                                  {task.title}
                                </p>
                                {isOverdue(task.due_date) && task.status !== "done" && (
                                  <AlertCircle className="w-3.5 h-3.5 text-upflow-danger flex-shrink-0" />
                                )}
                              </div>

                              {visibleCustomFields.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {visibleCustomFields.map((f) => (
                                    <CustomFieldChip
                                      key={f.id}
                                      definition={f}
                                      value={valueMap.get(f.id)}
                                      users={users}
                                    />
                                  ))}
                                </div>
                              )}

                              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                                {task.due_date && (
                                  <span
                                    className={cn(
                                      "text-[11px] text-muted-foreground flex items-center gap-1",
                                      isOverdue(task.due_date) &&
                                        task.status !== "done" &&
                                        "text-upflow-danger font-medium",
                                    )}
                                  >
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(task.due_date)}
                                  </span>
                                )}
                                {(task._count?.comments ?? 0) > 0 && (
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                    <MessageSquare className="w-3 h-3" />
                                    {task._count?.comments}
                                  </span>
                                )}
                                {(task._count?.subtasks ?? 0) > 0 && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {task._count?.subtasks} sub
                                  </span>
                                )}
                                {task.assignee && (
                                  <div
                                    title={task.assignee.name}
                                    className="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[10px] font-bold text-white shadow-[0_0_18px_rgba(59,130,246,0.35)]"
                                  >
                                    {getInitials(task.assignee.name)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                          }}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    <button
                      onClick={() => onAddTask(key)}
                      className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-muted-foreground transition-all hover:border-sky-400/35 hover:bg-sky-400/10 hover:text-foreground"
                    >
                      <Plus className="w-3 h-3" /> {t("projects.addTask")}
                    </button>
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {selectedTask && (
        <TaskDetailSheet
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            setSelectedTask(null);
            onUpdate();
          }}
        />
      )}
    </>
  );
}
