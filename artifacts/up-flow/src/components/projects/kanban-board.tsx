"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { Plus, GripVertical, Calendar, AlertCircle } from "lucide-react";
import { cn, formatDate, getInitials, isOverdue, priorityColor } from "@/lib/utils";
import TaskDetailSheet from "@/components/projects/task-detail-sheet";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import type { Task } from "@/lib/types";

interface KanbanBoardProps {
  projectId: string;
  tasks: Task[];
  onUpdate: () => void;
}

const COLUMNS = [
  { key: "todo", label: "To Do", color: "bg-gray-400" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "done", label: "Done", color: "bg-green-500" },
] as const;

type ColumnKey = "todo" | "in_progress" | "done";

export default function KanbanBoard({ projectId, tasks, onUpdate }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Record<ColumnKey, Task[]>>({
    todo: [],
    in_progress: [],
    done: [],
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState<ColumnKey | null>(null);

  useEffect(() => {
    const grouped: Record<ColumnKey, Task[]> = { todo: [], in_progress: [], done: [] };
    tasks.forEach((t) => {
      if (t.status in grouped) {
        grouped[t.status as ColumnKey].push(t);
      }
    });
    Object.keys(grouped).forEach((k) => {
      grouped[k as ColumnKey].sort((a, b) => a.position - b.position);
    });
    setColumns(grouped);
  }, [tasks]);

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

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
      await fetch(`/api/tasks/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: dstCol, position: destination.index }),
      });
    } catch {
      toast.error("Failed to update task");
      onUpdate();
    }
  };

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(({ key, label, color }) => (
            <Droppable key={key} droppableId={key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex-shrink-0 w-72 bg-muted/50 rounded-xl p-3 transition-colors",
                    snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", color)} />
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                        {columns[key].length}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowNewTask(key)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 min-h-[100px]">
                    {columns[key].map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            onClick={() => setSelectedTask(task)}
                            className={cn(
                              "bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all group",
                              snapshot.isDragging && "shadow-xl rotate-1 opacity-90"
                            )}
                          >
                            <div className="flex items-start gap-1.5">
                              <div
                                {...provided.dragHandleProps}
                                className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GripVertical className="w-3 h-3" />
                              </div>
                              <p className="flex-1 text-sm text-foreground font-medium leading-snug">
                                {task.title}
                              </p>
                              {isOverdue(task.due_date) && task.status !== "done" && (
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                              )}
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 ml-4">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2.5 ml-4">
                              <span
                                className={cn(
                                  "text-xs px-1.5 py-0.5 rounded font-medium",
                                  priorityColor(task.priority)
                                )}
                              >
                                {task.priority}
                              </span>
                              {task.due_date && (
                                <span
                                  className={cn(
                                    "text-xs text-muted-foreground flex items-center gap-1",
                                    isOverdue(task.due_date) &&
                                      task.status !== "done" &&
                                      "text-red-500 font-medium"
                                  )}
                                >
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(task.due_date)}
                                </span>
                              )}
                              {task.assignee && (
                                <div
                                  title={task.assignee.name}
                                  className="ml-auto w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0"
                                >
                                  {getInitials(task.assignee.name)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
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

      {showNewTask && (
        <NewTaskDialog
          open={!!showNewTask}
          onClose={() => setShowNewTask(null)}
          projectId={projectId}
          defaultStatus={showNewTask}
          onCreated={() => {
            setShowNewTask(null);
            onUpdate();
            toast.success("Task created!");
          }}
        />
      )}
    </>
  );
}
