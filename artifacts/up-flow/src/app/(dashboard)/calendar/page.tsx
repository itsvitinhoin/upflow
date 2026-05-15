"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/header";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { todayMeetings } from "@/lib/dashboard-mocks";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfMonthGrid(year: number, month: number) {
  // Returns the Monday on or before the 1st of the month.
  const first = new Date(year, month, 1);
  const dow = first.getDay(); // 0=Sun..6=Sat
  const offset = dow === 0 ? 6 : dow - 1;
  const start = new Date(year, month, 1 - offset);
  return start;
}

const taskColor: Record<Task["priority"], string> = {
  low: "bg-upflow-success/30 text-upflow-success border-l-upflow-success",
  medium: "bg-primary/30 text-primary border-l-primary",
  high: "bg-upflow-danger/30 text-upflow-danger border-l-upflow-danger",
};

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date>(today);

  useEffect(() => {
    let alive = true;
    fetch("/api/tasks?mine=true")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const list = (Array.isArray(d) ? d : d.items ?? d.tasks ?? []) as Task[];
        setTasks(list);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const gridStart = startOfMonthGrid(year, month);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const d = new Date(t.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    });
    return map;
  }, [tasks]);

  const selectedKey = `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`;
  const selectedTasks = tasksByDay.get(selectedKey) ?? [];
  const selectedIsToday = isSameDay(selected, today);

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };

  return (
    <>
      <Header title="Calendar" />
      <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Month grid */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">
                {MONTHS[month]} {year}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={goToday}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-foreground transition-colors"
              >
                Today
              </button>
              <button
                onClick={goPrev}
                aria-label="Previous month"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goNext}
                aria-label="Next month"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = d.getMonth() === month;
              const isToday = isSameDay(d, today);
              const isSelected = isSameDay(d, selected);
              const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
              const dayTasks = tasksByDay.get(key) ?? [];
              return (
                <button
                  key={key}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "h-20 rounded-lg p-1.5 flex flex-col items-start text-left transition-colors border",
                    isSelected
                      ? "border-primary/60 bg-primary/10"
                      : "border-transparent hover:bg-white/5",
                    !inMonth && "opacity-40"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isToday
                        ? "w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
                        : "text-foreground"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-1 w-full space-y-0.5 overflow-hidden">
                    {dayTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        title={t.title}
                        className={cn(
                          "truncate text-[10px] px-1 py-0.5 rounded border-l-2",
                          taskColor[t.priority]
                        )}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Day detail */}
        <aside className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {selectedIsToday ? "Today" : "Selected"}
            </p>
            <h3 className="text-lg font-semibold text-foreground mt-1">
              {selected.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>

            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Due tasks
              </p>
              {loading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : selectedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nothing due on this day.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedTasks.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={t.project ? `/projects/${t.project.id}` : "#"}
                        className={cn(
                          "block px-3 py-2 rounded-lg border-l-2 hover:bg-white/5 transition-colors",
                          taskColor[t.priority]
                        )}
                      >
                        <p className="text-xs font-medium text-foreground truncate">
                          {t.title}
                        </p>
                        {t.project?.name && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {t.project.name}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedIsToday && (
              <div className="mt-5 pt-4 border-t border-white/5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                  Today&apos;s meetings
                </p>
                <ul className="space-y-1.5">
                  {todayMeetings.map((m) => (
                    <li
                      key={m.title}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="font-mono tabular-nums text-muted-foreground w-12 flex-shrink-0">
                        {m.time}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] flex-shrink-0",
                          m.color
                        )}
                      >
                        {m.with}
                      </span>
                      <span className="text-foreground truncate">
                        {m.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Legend
              </p>
            </div>
            <ul className="text-xs space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-upflow-danger/40 border-l-2 border-l-upflow-danger" />
                High priority
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-primary/40 border-l-2 border-l-primary" />
                Medium priority
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-upflow-success/40 border-l-2 border-l-upflow-success" />
                Low priority
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
