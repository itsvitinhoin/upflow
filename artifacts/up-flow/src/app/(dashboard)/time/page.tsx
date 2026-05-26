"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/header";
import { Clock, TrendingUp, Calendar as CalendarIcon, FolderKanban } from "lucide-react";
import { logError } from "@/lib/log-error";
import type { TimeEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday() {
  const d = startOfToday();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function dayIndex(value: string) {
  const d = new Date(value).getDay();
  return d === 0 ? 6 : d - 1;
}

function entrySeconds(entry: TimeEntry, now: Date) {
  if (entry.status === "running" && !entry.stopped_at) {
    return Math.max(0, Math.round((now.getTime() - new Date(entry.started_at).getTime()) / 1000));
  }
  return entry.duration_seconds;
}

export default function TimePage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const weekStart = startOfWeekMonday();
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(weekStart.getDate() + 7);
    let alive = true;
    fetch(`/api/time/entries?from=${weekStart.toISOString()}&to=${nextWeek.toISOString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setEntries((data.items ?? []) as TimeEntry[]);
      })
      .catch((err) => logError("time:load-entries", err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const todayIdx = dayIndex(startOfToday().toISOString());

  const totals = useMemo(() => {
    const perDay = Array.from({ length: 7 }, () => 0);
    const perProject = new Map<string, number>();
    const todayStart = startOfToday();
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    entries.forEach((entry) => {
      const seconds = entrySeconds(entry, now);
      const idx = dayIndex(entry.started_at);
      perDay[idx] += seconds;
      const project = entry.project?.name ?? "No project";
      perProject.set(project, (perProject.get(project) ?? 0) + seconds);
    });

    const weekSeconds = perDay.reduce((sum, seconds) => sum + seconds, 0);
    const todaySeconds = entries
      .filter((entry) => {
        const started = new Date(entry.started_at);
        return started >= todayStart && started < tomorrowStart;
      })
      .reduce((sum, entry) => sum + entrySeconds(entry, now), 0);
    const activeDays = perDay.filter((seconds) => seconds > 0).length;

    return {
      perDay,
      weekMinutes: Math.round(weekSeconds / 60),
      todayMinutes: Math.round(todaySeconds / 60),
      averageMinutes: activeDays > 0 ? Math.round(weekSeconds / 60 / activeDays) : 0,
      perProject: Array.from(perProject, ([project, seconds]) => ({
        project,
        minutes: Math.round(seconds / 60),
      })).sort((a, b) => b.minutes - a.minutes),
    };
  }, [entries, now]);

  const maxDayMinutes = Math.max(1, ...totals.perDay.map((seconds) => Math.round(seconds / 60)));

  return (
    <>
      <Header title="Time tracking" />
      <div className="space-y-6 overflow-x-hidden p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="This week"
            value={fmtHM(totals.weekMinutes)}
            icon={<Clock className="w-4 h-4" />}
          />
          <SummaryCard
            label="Today"
            value={fmtHM(totals.todayMinutes)}
            icon={<CalendarIcon className="w-4 h-4" />}
          />
          <SummaryCard
            label="Daily average"
            value={fmtHM(totals.averageMinutes)}
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Weekly hours</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Time tracked from saved entries
              </p>
            </div>
          </div>
          <div className="flex items-end gap-3 h-40 pl-2">
            {DAY_LABELS.map((label, idx) => {
              const mins = Math.round(totals.perDay[idx] / 60);
              const heightPct = (mins / maxDayMinutes) * 100;
              const isToday = idx === todayIdx;
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex-1 w-full flex items-end">
                    <div
                      title={`${label}: ${fmtHM(mins)}`}
                      className={cn(
                        "w-full rounded-t-md transition-all",
                        isToday ? "bg-primary" : "bg-primary/30 hover:bg-primary/50",
                      )}
                      style={{ height: `${mins === 0 ? 4 : Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px]",
                      isToday ? "text-primary font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">By project</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Time logged per project this week
              </p>
            </div>
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
          </div>
          {loading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading...</p>
          ) : totals.perProject.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No tracked time this week.
            </p>
          ) : (
            <ul className="space-y-3">
              {totals.perProject.map(({ project, minutes }) => {
                const pct = totals.weekMinutes > 0 ? (minutes / totals.weekMinutes) * 100 : 0;
                return (
                  <li key={project} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground/90 truncate pr-2">{project}</span>
                      <span className="font-mono text-muted-foreground tabular-nums">
                        {fmtHM(minutes)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="font-mono text-2xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
