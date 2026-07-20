"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { Plus, Calendar, AlertCircle, MessageSquare, Trash2, MoreHorizontal } from "lucide-react";
import { cn, getInitials, isOverdue, relativeDueDateLabel } from "@/lib/utils";
import { getTaskCoverDisplayUrl } from "@/lib/task-images";
import { useLanguage } from "@/components/language-provider";
import MarketingB2BOnboardingForm from "@/components/onboarding/marketing-b2b-onboarding-form";
import MarketingB2COnboardingForm from "@/components/onboarding/marketing-b2c-onboarding-form";
import TaskDetailSheet from "@/components/projects/task-detail-sheet";
import CustomFieldChip from "@/components/projects/custom-field-chip";
import { PriorityBadge } from "@/components/projects/priority-ui";
import { RH_BOARD_FIELD_NAME, getRhBoardColumnColor } from "@/lib/rh-board";
import { CLICKUP_STATUS_FIELD_NAME, clickupStatusColor } from "@/lib/clickup-status";
import { SPACE_TASK_STATUS_FIELD_NAME, taskStatusForSpaceTaskStatus } from "@/lib/space-task-status";
import type {
  CustomFieldDefinition,
  Task,
  TaskAssignee,
  WorkflowStatus,
} from "@/lib/types";
import type { ToolbarState } from "@/components/projects/project-toolbar";

interface KanbanBoardProps {
  projectId: string;
  spaceId?: string | null;
  tasks: Task[];
  customFields: CustomFieldDefinition[];
  workflowStatuses: WorkflowStatus[];
  users: TaskAssignee[];
  toolbar?: ToolbarState;
  onUpdate: () => void;
  onAddTask: (status: ColumnKey, customFieldValues?: Record<string, unknown>) => void;
  onOpenTask?: (task: Task) => void;
  selectedTaskIds?: Set<string>;
  onToggleTaskSelection?: (taskId: string) => void;
  selectionMode?: boolean;
}

const COLUMNS = [
  { key: "todo", label: "To Do", color: "bg-muted-foreground/60", hex: "rgb(115 115 115)" },
  { key: "in_progress", label: "In Progress", color: "bg-primary", hex: "rgb(126 167 255)" },
  { key: "done", label: "Done", color: "bg-upflow-success", hex: "rgb(74 222 128)" },
] as const;

export type ColumnKey = "todo" | "in_progress" | "done";

interface BoardColumn {
  key: string;
  label: string;
  color: string;
  hex: string;
  terminal?: boolean;
}

function isColumnKey(value: string): value is ColumnKey {
  return value === "todo" || value === "in_progress" || value === "done";
}

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

export default function KanbanBoard({
  projectId,
  spaceId,
  tasks,
  customFields,
  workflowStatuses,
  users,
  toolbar,
  onUpdate,
  onAddTask,
  onOpenTask,
  selectedTaskIds,
  onToggleTaskSelection,
  selectionMode = false,
}: KanbanBoardProps) {
  const { language, t } = useLanguage();
  const spaceStatusField = customFields.find(
    (field) =>
      field.name === SPACE_TASK_STATUS_FIELD_NAME &&
      field.type === "dropdown" &&
      (field.options?.length ?? 0) > 0,
  );
  const boardStatusField = spaceStatusField ?? customFields.find(
    (field) =>
      (field.name === RH_BOARD_FIELD_NAME ||
        field.name === CLICKUP_STATUS_FIELD_NAME) &&
      field.type === "dropdown" &&
      (field.options?.length ?? 0) > 0,
  );
  const isSpaceWorkflowBoard = boardStatusField?.name === SPACE_TASK_STATUS_FIELD_NAME;
  const workflowStatusByName = useMemo(
    () =>
      new Map(
        workflowStatuses
          .filter(
            (status) =>
              status.category === "task" &&
              status.active &&
              (isSpaceWorkflowBoard
                ? status.space_id === spaceId
                : status.project_id === projectId),
          )
          .map((status) => [status.name, status]),
      ),
    [isSpaceWorkflowBoard, projectId, spaceId, workflowStatuses],
  );
  const boardColumns = useMemo<BoardColumn[]>(() => {
    if (boardStatusField?.options?.length) {
      return boardStatusField.options.map((label) => ({
        key: label,
        label,
        color: "bg-current",
        hex:
          workflowStatusByName.get(label)?.color ??
          (boardStatusField.name === RH_BOARD_FIELD_NAME
            ? getRhBoardColumnColor(label)
            : clickupStatusColor(label)),
        terminal: workflowStatusByName.get(label)?.terminal,
      }));
    }
    return COLUMNS.map((column) => ({ ...column }));
  }, [boardStatusField, workflowStatusByName]);
  const [columns, setColumns] = useState<Record<string, Task[]>>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const grouped: Record<string, Task[]> = Object.fromEntries(
      boardColumns.map((column) => [column.key, [] as Task[]]),
    );
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
      if (boardStatusField) {
        const fieldValue = (t.custom_field_values ?? []).find(
          (value) => value.definition_id === boardStatusField.id,
        )?.value;
        const columnKey =
          typeof fieldValue === "string" && fieldValue in grouped
            ? fieldValue
            : boardColumns[0]?.key;
        if (columnKey) grouped[columnKey].push(t);
        return;
      }

      if (t.status in grouped) {
        grouped[t.status as ColumnKey].push(t);
      }
    });
    Object.keys(grouped).forEach((k) => {
      grouped[k].sort((a, b) => a.position - b.position);
    });
    setColumns(grouped);
  }, [boardColumns, boardStatusField, tasks, toolbar]);

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

  const openTask = (task: Task) => {
    if (onOpenTask) {
      onOpenTask(task);
      return;
    }
    setSelectedTask(task);
  };

  const visibleCustomFields = customFields.filter(
    (f) => f.id !== boardStatusField?.id && (toolbar?.visibleColumns?.[f.id] ?? true),
  );

  const taskStatusForBoardColumn = (columnKey: string): ColumnKey => {
    const index = boardColumns.findIndex((column) => column.key === columnKey);
    return taskStatusForSpaceTaskStatus(boardColumns[index], index);
  };

  const addTaskToColumn = (columnKey: string) => {
    if (boardStatusField) {
      onAddTask(
        isSpaceWorkflowBoard ? taskStatusForBoardColumn(columnKey) : "todo",
        { [boardStatusField.id]: columnKey },
      );
      return;
    }
    if (isColumnKey(columnKey)) onAddTask(columnKey);
  };

  const taskWithCustomBoardValue = (task: Task, value: string): Task => ({
    ...task,
    custom_field_values: [
      ...(task.custom_field_values ?? []).filter(
        (fieldValue) => fieldValue.definition_id !== boardStatusField?.id,
      ),
      ...(boardStatusField ? [{ definition_id: boardStatusField.id, value }] : []),
    ],
  });

  const handleDragEnd = async (result: DropResult) => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index)
      return;

    const srcCol = source.droppableId;
    const dstCol = destination.droppableId;
    if (!boardStatusField && (!isColumnKey(srcCol) || !isColumnKey(dstCol))) return;

    const newColumns = { ...columns };
    const srcItems = [...(newColumns[srcCol] ?? [])];
    const [removed] = srcItems.splice(source.index, 1);
    if (!removed) return;
    newColumns[srcCol] = srcItems;

    const dstItems = srcCol === dstCol ? srcItems : [...(newColumns[dstCol] ?? [])];
    const movedTask = boardStatusField
      ? {
          ...taskWithCustomBoardValue(removed, dstCol),
          ...(isSpaceWorkflowBoard ? { status: taskStatusForBoardColumn(dstCol) } : {}),
        }
      : { ...removed, status: dstCol as ColumnKey };
    dstItems.splice(destination.index, 0, movedTask);
    newColumns[dstCol] = dstItems;

    setColumns(newColumns);

    try {
      const res = boardStatusField
        ? await fetch(`/api/tasks/${draggableId}/custom-fields`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              definition_id: boardStatusField.id,
              value: dstCol,
              ...(isSpaceWorkflowBoard
                ? { task_status: taskStatusForBoardColumn(dstCol) }
                : {}),
            }),
          })
        : await fetch(`/api/projects/${projectId}/reorder-tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              movedTaskId: draggableId,
              srcColumn: srcCol,
              dstColumn: dstCol,
              dstIndex: destination.index,
            }),
          });
      if (!res.ok) throw new Error(await readTaskApiError(res, t("common.failedToUpdate")));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.failedToUpdate"));
      onUpdate();
    }
  };

  return (
    <>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex h-[calc(100dvh-300px)] min-h-[440px] max-w-full gap-4 overflow-x-auto overscroll-x-contain pb-5 sm:h-[calc(100dvh-280px)]">
          {boardColumns.map(({ key, label, color, hex }) => (
            <Droppable key={key} droppableId={key}>
              {(provided, snapshot) => {
                const columnTasks = columns[key] ?? [];
                const displayLabel = isColumnKey(key) ? columnLabel(key, label, t) : label;

                return (
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
                    <div
                      className={cn("h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]", color)}
                      style={{ color: hex }}
                    />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      {displayLabel}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {columnTasks.length}
                    </span>
                    <button
                      onClick={() => addTaskToColumn(key)}
                      className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
                      title={t("projects.addTask")}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                    {columnTasks.map((task, index) => {
                      const valueMap = new Map(
                        (task.custom_field_values ?? []).map((v) => [v.definition_id, v.value]),
                      );
                      const isSelected = selectedTaskIds?.has(task.id) ?? false;
                      const coverImageUrl = getTaskCoverDisplayUrl(task.cover_image_url);
                      return (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                          isDragDisabled={selectionMode}
                        >
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
                                if (selectionMode && onToggleTaskSelection) {
                                  onToggleTaskSelection(task.id);
                                  return;
                                }
                                openTask(task);
                              }}
                              className={cn(
                                "upflow-task-card group relative cursor-pointer rounded-xl p-3 transition-all hover:-translate-y-0.5",
                                snapshot.isDragging && "rotate-1 opacity-95 shadow-[0_24px_60px_rgba(59,130,246,0.24)]",
                                isSelected && "bg-blue-500/10 ring-2 ring-blue-400/70",
                              )}
                            >
                              {!selectionMode && (
                                <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-lg border border-border bg-popover text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openTask(task);
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
                              )}
                              {coverImageUrl && (
                                <div className="-mx-3 -mt-3 mb-3 overflow-hidden rounded-t-xl border-b border-border bg-muted/30">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={coverImageUrl}
                                    alt=""
                                    className="aspect-video w-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                              <div className="flex items-start gap-2">
                                {selectionMode && onToggleTaskSelection && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => onToggleTaskSelection(task.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    aria-label={t("task.selectTask", { title: task.title })}
                                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary/40"
                                  />
                                )}
                                <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug text-foreground">
                                  {task.title}
                                </p>
                                {isOverdue(task.due_date) && task.status !== "done" && (
                                  <AlertCircle className="w-3.5 h-3.5 text-upflow-danger flex-shrink-0" />
                                )}
                              </div>

                              <div className="mt-2">
                                <PriorityBadge priority={task.priority} t={t} />
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
                                    {relativeDueDateLabel(task.due_date, language)}
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
                                    {t("task.subtasksCount", { count: task._count?.subtasks ?? 0 })}
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
                      onClick={() => addTaskToColumn(key)}
                      className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                    >
                      <Plus className="w-3 h-3" /> {t("projects.addTask")}
                    </button>
                  </div>
                </div>
              );
              }}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {selectedTask?.marketing_b2b_onboarding_form ? (
        <MarketingB2BOnboardingForm
          taskId={selectedTask.id}
          onClose={() => setSelectedTask(null)}
          onAddTask={() => {
            setSelectedTask(null);
            onAddTask("todo");
          }}
          onUpdate={() => {
            setSelectedTask(null);
            onUpdate();
          }}
        />
      ) : selectedTask?.marketing_b2c_onboarding_form ? (
        <MarketingB2COnboardingForm
          taskId={selectedTask.id}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            setSelectedTask(null);
            onUpdate();
          }}
        />
      ) : selectedTask ? (
        <TaskDetailSheet
          task={selectedTask}
          users={users}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            setSelectedTask(null);
            onUpdate();
          }}
        />
      ) : null}
    </>
  );
}

async function readTaskApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}
