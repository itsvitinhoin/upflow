"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/header";
import { Clock, TrendingUp, Calendar as CalendarIcon, FolderKanban } from "lucide-react";
import { weekActivity } from "@/lib/dashboard-mocks";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

type Split = { project: string; minutes: number; day: number };

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function TimePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setProjects(Array.isArray(d) ? d : d.projects ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Synthesize per-project splits from week activity + projects so the page
  // shows meaningful, consistent data without a backend time-log table.
  const splits = useMemo<Split[]>(() => {
    if (projects.length === 0) return [];
    const out: Split[] = [];
    weekActivity.forEach((d, di) => {
      d.dots.forEach((size, i) => {
        const proj = projects[(di + i) % projects.length];
        out.push({
          project: proj.name,
          minutes: Math.round(size * 6), // dot size → minutes
          day: di,
        });
      });
    });
    return out;
  }, [projects]);

  const todayIdx = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();

  const totalWeekMinutes = splits.reduce((s, x) => s + x.minutes, 0);
  const todayMinutes = splits
    .filter((s) => s.day === todayIdx)
    .reduce((s, x) => s + x.minutes, 0);
  const avgDaily = totalWeekMinutes / 7;

  const perProject = useMemo(() => {
    const map = new Map<string, number>();
    splits.forEach((s) => map.set(s.project, (map.get(s.project) ?? 0) + s.minutes));
    return Array.from(map, ([project, minutes]) => ({ project, minutes })).sort(
      (a, b) => b.minutes - a.minutes
    );
  }, [splits]);

  const maxDayMinutes = Math.max(
    1,
    ...DAY_LABELS.map(
      (_, di) =>
        splits.filter((s) => s.day === di).reduce((s, x) => s + x.minutes, 0)
    )
  );

  return (
    <>
      <Header title="Time tracking" />
      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="This week"
            value={fmtHM(totalWeekMinutes)}
            icon={<Clock className="w-4 h-4" />}
          />
          <SummaryCard
            label="Today"
            value={fmtHM(todayMinutes)}
            icon={<CalendarIcon className="w-4 h-4" />}
          />
          <SummaryCard
            label="Daily average"
            value={fmtHM(Math.round(avgDaily))}
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>

        {/* Weekly chart */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Weekly hours</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hours tracked across the past week
              </p>
            </div>
          </div>
          <div className="flex items-end gap-3 h-40 pl-2">
            {DAY_LABELS.map((label, di) => {
              const mins = splits
                .filter((s) => s.day === di)
                .reduce((s, x) => s + x.minutes, 0);
              const heightPct = (mins / maxDayMinutes) * 100;
              const isToday = di === todayIdx;
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex-1 w-full flex items-end">
                    <div
                      title={`${label}: ${fmtHM(mins)}`}
                      className={cn(
                        "w-full rounded-t-md transition-all",
                        isToday ? "bg-primary" : "bg-primary/30 hover:bg-primary/50"
                      )}
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[10px]",
                      isToday ? "text-primary font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Per-project breakdown */}
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
            <p className="text-xs text-muted-foreground py-6 text-center">Loading…</p>
          ) : perProject.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No projects yet. Create one to start logging time.
            </p>
          ) : (
            <ul className="space-y-3">
              {perProject.map(({ project, minutes }) => {
                const pct = (minutes / totalWeekMinutes) * 100;
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
