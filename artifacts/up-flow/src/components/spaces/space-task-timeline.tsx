"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import type { Task } from "@/lib/types";
import { cn, formatDate, formatLongDate, formatTime } from "@/lib/utils";
import {
  clampTaskTimelineBlock,
  isSameLocalDay,
  taskDueHour,
  taskTimelineClass,
  type TaskTimelineItem,
  type TaskStatus,
} from "@/components/spaces/space-dashboard-utils";

export function SpaceTaskTimeline({
  tasks,
  onCreateTask,
}: {
  tasks: Task[];
  onCreateTask: () => void;
}) {
  const { language, t } = useLanguage();
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i);
  const totalHours = 11;
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [todayLabel, setTodayLabel] = useState("");
  const statusLabels: Record<TaskStatus, string> = {
    todo: t("spaceDashboard.statusTodo"),
    in_progress: t("spaceDashboard.statusInProgress"),
    done: t("spaceDashboard.statusDone"),
  };

  useEffect(() => {
    const now = new Date();
    setCurrentHour(now.getHours());
    setTodayLabel(formatLongDate(now, language));
  }, [language]);

  const timelineItems = useMemo<TaskTimelineItem[]>(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    return tasks
      .filter((task) => task.due_date)
      .map((task) => {
        const due = new Date(task.due_date as string);
        const overdue = task.status !== "done" && due < todayStart;
        if (!overdue && !isSameLocalDay(due, now)) return null;
        const block = clampTaskTimelineBlock(overdue ? 8 : taskDueHour(due));
        return { task, due, overdue, ...block };
      })
      .filter((item): item is TaskTimelineItem => Boolean(item))
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        if (a.start !== b.start) return a.start - b.start;
        return a.task.position - b.task.position;
      })
      .slice(0, 8);
  }, [tasks]);

  const overdueCount = timelineItems.filter((item) => item.overdue).length;
  const dueTodayCount = timelineItems.length - overdueCount;

  const formatHour = (n: number) => {
    if (language === "pt-BR") return String(n).padStart(2, "0") + "h";
    return n > 12 ? String(n - 12) + "pm" : n === 12 ? "12pm" : String(n) + "am";
  };

  return (
    <section className="glass rounded-xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("spaceDashboard.taskTimeline")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span suppressHydrationWarning>{todayLabel || "\u00A0"}</span>
            {timelineItems.length > 0 && (
              <>
                {" - "}
                <span>{t("spaceDashboard.dueToday", { count: dueTodayCount })}</span>
                {overdueCount > 0 && (
                  <>
                    {" - "}
                    <span className="text-upflow-danger">
                      {t("spaceDashboard.overdueCount", { count: overdueCount })}
                    </span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <button
          onClick={onCreateTask}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("spaceDashboard.newTask")}
        </button>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[900px]">
          <div className="flex items-center gap-1 pb-3 pl-[188px]">
            {hours.map((h) => {
              const isCurrent = h === currentHour;
              return (
                <div
                  key={h}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-muted-foreground",
                  )}
                >
                  {formatHour(h)}
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {timelineItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("spaceDashboard.noTasksScheduledToday")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("spaceDashboard.tasksWithDueDatesAppear")}
                </p>
              </div>
            ) : (
              timelineItems.map(({ task, due, start, end, overdue }) => {
                const dimCurrent =
                  currentHour !== null && (end < currentHour || start > currentHour + 1);
                return (
                  <Link
                    key={task.id}
                    href={`/projects/${task.project_id}`}
                    className="-mx-1 flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 group"
                  >
                    <div className="flex w-[176px] flex-shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          overdue
                            ? "bg-upflow-danger"
                            : task.status === "done"
                              ? "bg-upflow-success"
                              : task.status === "in_progress"
                                ? "bg-primary"
                                : "bg-white/40",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground group-hover:text-primary">
                          {task.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {task.project?.name || t("spaceDashboard.list")} -{" "}
                          {overdue ? t("spaceDashboard.overdue") : formatDate(task.due_date, language)}
                        </p>
                      </div>
                    </div>
                    <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-white/5">
                      <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-12">
                        {hours.map((h) => (
                          <div
                            key={h}
                            className={cn(
                              "border-r border-white/5 last:border-r-0",
                              h === currentHour && "bg-primary/10",
                            )}
                          />
                        ))}
                      </div>
                      <div
                        title={`${task.title} - ${overdue ? t("spaceDashboard.overdue") : formatTime(due, language)}`}
                        className={cn(
                          "absolute bottom-1 top-1 flex items-center rounded-md border-l-2 px-2 text-[10px] font-medium transition-opacity",
                          taskTimelineClass(task, overdue),
                          dimCurrent && "opacity-70",
                        )}
                        style={{
                          left: `calc(${((start - 8) / totalHours) * 100}% + 2px)`,
                          width: `calc(${Math.max(((end - start) / totalHours) * 100, 5)}% - 4px)`,
                        }}
                      >
                        <span className="truncate">
                          {overdue ? t("spaceDashboard.overdue") : statusLabels[task.status]}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
