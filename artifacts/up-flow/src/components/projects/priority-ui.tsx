import { Flag } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

type Translate = (key: string, vars?: Record<string, string | number>) => string;
export type TaskPriority = Task["priority"];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const satisfies readonly TaskPriority[];

export function priorityLabel(priority: TaskPriority, t: Translate) {
  if (priority === "high") return t("priority.high");
  if (priority === "medium") return t("priority.medium");
  return t("priority.low");
}

export function priorityDescription(priority: TaskPriority, t: Translate) {
  if (priority === "high") return t("priority.highHint");
  if (priority === "medium") return t("priority.mediumHint");
  return t("priority.lowHint");
}

export function priorityToneClass(priority: TaskPriority) {
  if (priority === "high") {
    return "border-rose-400/45 bg-rose-500/10 text-rose-200 shadow-[0_0_18px_rgba(244,63,94,0.12)]";
  }
  if (priority === "medium") {
    return "border-amber-300/45 bg-amber-400/10 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.10)]";
  }
  return "border-slate-400/25 bg-slate-400/10 text-slate-300";
}

export function PriorityBadge({
  priority,
  t,
  className,
}: {
  priority: TaskPriority;
  t: Translate;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-none",
        priorityToneClass(priority),
        className,
      )}
      title={`${t("toolbar.priority")}: ${priorityLabel(priority, t)} - ${priorityDescription(priority, t)}`}
    >
      <Flag className="h-3 w-3" />
      {priorityLabel(priority, t)}
    </span>
  );
}

export function PriorityPicker({
  value,
  onChange,
  t,
}: {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
  t: Translate;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {TASK_PRIORITIES.map((priority) => {
        const selected = value === priority;

        return (
          <button
            key={priority}
            type="button"
            onClick={() => onChange(priority)}
            aria-pressed={selected}
            className={cn(
              "min-h-[70px] rounded-lg border px-3 py-2 text-left transition-all hover:-translate-y-0.5",
              priorityToneClass(priority),
              selected
                ? "ring-1 ring-current"
                : "opacity-75 hover:opacity-100",
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Flag className="h-3.5 w-3.5" />
              {priorityLabel(priority, t)}
            </span>
            <span className="mt-1 block text-[11px] leading-snug opacity-80">
              {priorityDescription(priority, t)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
