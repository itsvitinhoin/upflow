"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Task } from "@/lib/types";
import { cn, formatDate, isOverdue, priorityColor } from "@/lib/utils";

export function TaskDetailModal({
  task,
  updating,
  onClose,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  updating: boolean;
  onClose: () => void;
  onStatusChange: (task: Task, status: Task["status"]) => void;
  onDelete: (task: Task) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = `task-modal-title-${task.id}`;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {task.project?.name || "Task"}
            </p>
            <h3 id={titleId} className="mt-1 text-lg font-bold text-foreground">
              {task.title}
            </h3>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close"
            className="rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "rounded-full px-2 py-1 font-medium",
              priorityColor(task.priority),
            )}
          >
            {task.priority}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-1 capitalize text-foreground/80">
            {task.status.replace("_", " ")}
          </span>
          {task.due_date && (
            <span
              className={cn(
                "rounded-full bg-white/5 px-2 py-1",
                isOverdue(task.due_date) && task.status !== "done"
                  ? "text-upflow-danger"
                  : "text-foreground/80",
              )}
            >
              Due {formatDate(task.due_date)}
            </span>
          )}
        </div>

        {task.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
            {task.description}
          </p>
        )}

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <button
            onClick={() => onStatusChange(task, "todo")}
            disabled={updating || task.status === "todo"}
            className="rounded-xl bg-white/5 py-2 text-xs font-medium transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            To do
          </button>
          <button
            onClick={() => onStatusChange(task, "in_progress")}
            disabled={updating || task.status === "in_progress"}
            className="rounded-xl bg-upflow-warning/20 py-2 text-xs font-medium text-upflow-warning transition-colors hover:bg-upflow-warning/30 disabled:opacity-40"
          >
            In progress
          </button>
          <button
            onClick={() => onStatusChange(task, "done")}
            disabled={updating || task.status === "done"}
            className="rounded-xl bg-upflow-success/20 py-2 text-xs font-medium text-upflow-success transition-colors hover:bg-upflow-success/30 disabled:opacity-40"
          >
            Mark done
          </button>
        </div>

        <button
          onClick={() => {
            if (confirm(`Delete "${task.title}"?`)) onDelete(task);
          }}
          disabled={updating}
          className="mt-3 w-full rounded-xl py-2 text-xs font-medium text-upflow-danger transition-colors hover:bg-upflow-danger/10 disabled:opacity-40"
        >
          Delete task
        </button>
      </div>
    </div>
  );
}
