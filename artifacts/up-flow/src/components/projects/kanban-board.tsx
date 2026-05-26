"use client";

import { useState, useEffect, useRef } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { Plus, Calendar, AlertCircle, MessageSquare, Trash2, MoreHorizontal } from "lucide-react";
import { cn, formatDate, getInitials, isOverdue } from "@/lib/utils";
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

export default function KanbanBoard({
  projectId,
  tasks,
  customFields,
  users,
  toolbar,
  onUpdate,
  onAddTask,
}: KanbanBoardProps) {
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
    if (!confirm("Delete this task?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onUpdate();
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete");
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
        <div className="flex gap-3 overflow-x-auto pb-4 h-[calc(100vh-280px)]">
          {COLUMNS.map(({ key, label, color, hex }) => (
            <Droppable key={key} droppableId={key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-shrink-0 w-[300px] rounded-lg flex flex-col bg-muted/40 transition-colors h-full overflow-hidden",
                    snapshot.isDraggingOver && "bg-primary/5 ring-1 ring-primary/30",
                  )}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-t-lg border-t-2"
                    style={{ borderColor: hex }}
                  >
                    <div className={cn("w-2 h-2 rounded-full", color)} />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      {label}
                    </span>
                    <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      {columns[key].length}
                    </span>
                    <button
                      onClick={() => onAddTask(key)}
                      className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                      title="Add task"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="px-2 pb-2 space-y-1.5 flex-1 overflow-y-auto">
                    {columns[key].map((task, index) => {
                      const valueMap = new Map(
                        (task.custom_field_values ?? []).map((v) => [v.definition_id, v.value]),
                      );
                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => {
                                if (isDraggingRef.current) return;
                                setSelectedTask(task);
                              }}
                              className={cn(
                                "relative bg-card border border-border rounded-md p-2.5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group",
                                snapshot.isDragging && "shadow-xl rotate-1 opacity-90",
                              )}
                            >
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card border border-border rounded-md shadow-sm">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTask(task);
                                  }}
                                  className="p-1 text-muted-foreground hover:text-foreground rounded"
                                  title="Open"
                                >
                                  <MoreHorizontal className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTask(task.id);
                                  }}
                                  className="p-1 text-muted-foreground hover:text-destructive rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              {task.cover_image_url && (
                                <div className="-mx-2.5 -mt-2.5 mb-2 overflow-hidden rounded-t-md border-b border-border bg-muted/30">
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
                                    "mt-1 w-2 h-2 rounded-full flex-shrink-0",
                                    task.priority === "high"
                                      ? "bg-upflow-danger"
                                      : task.priority === "medium"
                                        ? "bg-upflow-warning"
                                        : "bg-muted-foreground/50",
                                  )}
                                  title={`Priority: ${task.priority}`}
                                />
                                <p className="flex-1 text-sm text-foreground leading-snug">
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

                              <div className="flex items-center gap-2 mt-2">
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
                                    className="ml-auto w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                                  >
                                    {getInitials(task.assignee.name)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    <button
                      onClick={() => onAddTask(key)}
                      className="w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md px-2 py-1.5 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add task
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
