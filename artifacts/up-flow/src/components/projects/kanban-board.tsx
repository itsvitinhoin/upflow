"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import {
  Plus,
  Calendar,
  AlertCircle,
  MessageSquare,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  FileText,
} from "lucide-react";
import { cn, getInitials, isOverdue, relativeDueDateLabel } from "@/lib/utils";
import { getTaskCoverDisplayUrl } from "@/lib/task-images";
import { useLanguage } from "@/components/language-provider";
import MarketingB2BOnboardingForm from "@/components/onboarding/marketing-b2b-onboarding-form";
import MarketingB2COnboardingForm from "@/components/onboarding/marketing-b2c-onboarding-form";
import TaskDetailSheet from "@/components/projects/task-detail-sheet";
import CustomFieldChip from "@/components/projects/custom-field-chip";
import { PriorityBadge } from "@/components/projects/priority-ui";
import { getRhBoardColumnColor } from "@/lib/rh-board";
import { clickupStatusColor } from "@/lib/clickup-status";
import {
  resolveTaskBoardStatus,
  taskStatusForTaskBoardOption,
} from "@/lib/task-board-status";
import { parseTaskBrief } from "@/lib/task-templates";
import { isCreativeBriefingType } from "@/lib/creative-briefing";
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
  showBriefingDetails?: boolean;
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

function isReferenceFileLink(label: string) {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized === "reference file link" || normalized === "arquivo de referencia link";
}

function externalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function linkLabel(value: string) {
  const url = externalUrl(value);
  if (!url) return value;
  return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
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
  showBriefingDetails = false,
}: KanbanBoardProps) {
  const { language, t } = useLanguage();
  const boardStatus = useMemo(
    () =>
      resolveTaskBoardStatus({
        customFields,
        workflowStatuses,
        projectId,
        spaceId,
      }),
    [customFields, projectId, spaceId, workflowStatuses],
  );
  const boardStatusField = boardStatus?.field;
  const boardColumns = useMemo<BoardColumn[]>(() => {
    if (boardStatus) {
      return boardStatus.options.map((option) => ({
        key: option.value,
        label: option.value,
        color: "bg-current",
        hex:
          option.color ??
          (boardStatus.kind === "rh"
            ? getRhBoardColumnColor(option.value)
            : clickupStatusColor(option.value)),
        terminal: option.terminal,
      }));
    }
    return COLUMNS.map((column) => ({ ...column }));
  }, [boardStatus]);
  const [columns, setColumns] = useState<Record<string, Task[]>>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeColumnKey, setActiveColumnKey] = useState<string | null>(
    () => boardColumns[0]?.key ?? null,
  );
  const isDraggingRef = useRef(false);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setActiveColumnKey((current) =>
      current && boardColumns.some((column) => column.key === current)
        ? current
        : (boardColumns[0]?.key ?? null),
    );
  }, [boardColumns]);

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

  const taskStatusForBoardColumn = (columnKey: string) =>
    taskStatusForTaskBoardOption(boardStatus, columnKey);

  const addTaskToColumn = (columnKey: string) => {
    if (boardStatusField) {
      onAddTask(
        taskStatusForBoardColumn(columnKey) ?? "todo",
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
    const boardTaskStatus = taskStatusForBoardColumn(dstCol);
    const movedTask = boardStatusField
      ? {
          ...taskWithCustomBoardValue(removed, dstCol),
          ...(boardTaskStatus ? { status: boardTaskStatus } : {}),
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
              ...(boardTaskStatus ? { task_status: boardTaskStatus } : {}),
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

  const scrollToColumn = (columnKey: string) => {
    const board = boardScrollRef.current;
    const column = columnRefs.current[columnKey];
    if (!board || !column) return;

    const boardRect = board.getBoundingClientRect();
    const columnRect = column.getBoundingClientRect();
    const maxScrollLeft = Math.max(0, board.scrollWidth - board.clientWidth);
    const scrollLeft = Math.min(
      Math.max(0, board.scrollLeft + columnRect.left - boardRect.left - 12),
      maxScrollLeft,
    );
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    setActiveColumnKey(columnKey);
    board.scrollTo({
      left: scrollLeft,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <>
      <nav
        aria-label={t("toolbar.status")}
        className="mb-3 flex max-w-full items-center gap-2 overflow-x-auto pb-1"
      >
        {boardColumns.map(({ key, label, color, hex }, columnIndex) => {
          const displayLabel = isColumnKey(key) ? columnLabel(key, label, t) : label;
          const isActiveColumn = activeColumnKey === key;

          return (
            <button
              key={key}
              type="button"
              data-kanban-scroll-target={key}
              aria-controls={`kanban-column-${columnIndex}`}
              aria-pressed={isActiveColumn}
              onClick={() => scrollToColumn(key)}
              className={cn(
                "flex flex-shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                isActiveColumn
                  ? "border-primary/45 bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <span
                className={cn("h-2 w-2 rounded-full shadow-[0_0_10px_currentColor]", color)}
                style={{ color: hex }}
              />
              <span>{displayLabel}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {columns[key]?.length ?? 0}
              </span>
            </button>
          );
        })}
      </nav>
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          ref={boardScrollRef}
          data-kanban-scroll-container
          className={cn(
            "flex max-w-full gap-4 overflow-x-auto overscroll-x-contain pb-5",
            showBriefingDetails
              ? "h-[calc(100dvh-270px)] min-h-[520px] sm:h-[calc(100dvh-250px)]"
              : "h-[calc(100dvh-300px)] min-h-[440px] sm:h-[calc(100dvh-280px)]",
          )}
        >
          {boardColumns.map(({ key, label, color, hex }, columnIndex) => (
            <Droppable key={key} droppableId={key}>
              {(provided, snapshot) => {
                const columnTasks = columns[key] ?? [];
                const displayLabel = isColumnKey(key) ? columnLabel(key, label, t) : label;
                const isActiveColumn = activeColumnKey === key;

                return (
                <div
                  id={`kanban-column-${columnIndex}`}
                  data-kanban-column={key}
                  data-kanban-active={isActiveColumn ? "true" : "false"}
                  ref={(element) => {
                    provided.innerRef(element);
                    columnRefs.current[key] = element;
                  }}
                  {...provided.droppableProps}
                  className={cn(
                    "upflow-kanban-column flex h-full flex-shrink-0 flex-col overflow-hidden rounded-2xl transition-all",
                    showBriefingDetails
                      ? "w-[min(90vw,470px)] sm:w-[430px] xl:w-[460px]"
                      : "w-[min(88vw,380px)] sm:w-[360px] xl:w-[380px]",
                    isActiveColumn && "border-primary/45 shadow-[0_0_30px_rgba(59,130,246,0.18)] ring-1 ring-primary/25",
                    snapshot.isDraggingOver && "border-sky-400/50 shadow-[0_0_36px_rgba(59,130,246,0.22)] ring-1 ring-sky-400/30",
                  )}
                >
                  <div
                    className="flex items-center gap-2 border-t-2 px-4 py-3"
                    style={{ borderColor: hex }}
                  >
                    <button
                      type="button"
                      data-kanban-column-header={key}
                      aria-controls={`kanban-column-${columnIndex}`}
                      aria-pressed={isActiveColumn}
                      onClick={() => scrollToColumn(key)}
                      className="flex min-w-0 items-center gap-2 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <span
                        className={cn("h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]", color)}
                        style={{ color: hex }}
                      />
                      <span className="truncate text-xs font-semibold text-foreground uppercase tracking-wider">
                        {displayLabel}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {columnTasks.length}
                      </span>
                    </button>
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
                      const structuredBrief = showBriefingDetails
                        ? parseTaskBrief(task.description, language)
                        : null;
                      const isCreativeBrief = Boolean(
                        structuredBrief && isCreativeBriefingType(structuredBrief.type),
                      );
                      const briefingDetails = isCreativeBrief
                        ? (structuredBrief?.details ?? [])
                            .filter((detail) => !isReferenceFileLink(detail.label))
                            .slice(0, 12)
                        : [];
                      const plainDescription =
                        showBriefingDetails && !isCreativeBrief ? task.description?.trim() : "";
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
                                "upflow-task-card group relative cursor-pointer rounded-xl transition-all hover:-translate-y-0.5",
                                showBriefingDetails ? "p-3.5" : "p-3",
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
                                <div
                                  className={cn(
                                    "mb-3 overflow-hidden rounded-t-xl border-b border-border bg-muted/30",
                                    showBriefingDetails ? "-mx-3.5 -mt-3.5" : "-mx-3 -mt-3",
                                  )}
                                >
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

                              {briefingDetails.length > 0 && (
                                <div className="mt-3 border-t border-border/80 pt-3">
                                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                    <FileText className="h-3.5 w-3.5" />
                                    {t("creativeBrief.title")}
                                  </div>
                                  <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                                    {briefingDetails.map((detail) => {
                                      const url = externalUrl(detail.value);
                                      return (
                                        <div
                                          key={`${detail.label}-${detail.value}`}
                                          className={cn("min-w-0", url && "sm:col-span-2")}
                                        >
                                          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            {detail.label}
                                          </dt>
                                          {url ? (
                                            <dd className="mt-0.5 min-w-0">
                                              <a
                                                href={url.toString()}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(event) => event.stopPropagation()}
                                                onMouseDown={(event) => event.stopPropagation()}
                                                className="inline-flex max-w-full items-center gap-1 break-all text-xs font-medium text-primary hover:underline"
                                              >
                                                <span className="truncate">{linkLabel(detail.value)}</span>
                                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                              </a>
                                            </dd>
                                          ) : (
                                            <dd className="mt-0.5 break-words text-xs leading-5 text-foreground">
                                              {detail.value}
                                            </dd>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </dl>
                                </div>
                              )}

                              {plainDescription && (
                                <div className="mt-3 border-t border-border/80 pt-3">
                                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {t("task.descriptionBrief")}
                                  </p>
                                  <p className="mt-1 whitespace-pre-line break-words text-xs leading-5 text-foreground/85 line-clamp-6">
                                    {plainDescription}
                                  </p>
                                </div>
                              )}

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
          customFields={customFields}
          workflowStatuses={workflowStatuses}
          spaceId={spaceId}
          onChanged={onUpdate}
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
