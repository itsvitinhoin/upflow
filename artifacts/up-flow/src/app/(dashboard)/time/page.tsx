"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/header";
import { Calendar as CalendarIcon, Clock, FolderKanban, Loader2, Play, Square, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { logError } from "@/lib/log-error";
import type { TimeEntry } from "@/lib/types";
import { appDateKey, appDateTimeToUtc, cn } from "@/lib/utils";

const DAY_LABEL_KEYS = [
  "time.day.mon",
  "time.day.tue",
  "time.day.wed",
  "time.day.thu",
  "time.day.fri",
  "time.day.sat",
  "time.day.sun",
];

function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

function mergeRunningEntry(entries: TimeEntry[], running: TimeEntry | null) {
  if (!running) return entries;
  return entries.some((entry) => entry.id === running.id)
    ? entries.map((entry) => (entry.id === running.id ? running : entry))
    : [running, ...entries];
}

function appDateTuple(value: string | Date) {
  return appDateKey(value).split("-").map(Number) as [number, number, number];
}

function startOfWeekMonday(now = new Date()) {
  const [year, month, day] = appDateTuple(now);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return appDateTimeToUtc(year, month, day + diff);
}

function startOfNextWeek(weekStart: Date) {
  const [year, month, day] = appDateTuple(weekStart);
  return appDateTimeToUtc(year, month, day + 7);
}

function dayIndex(value: string | Date) {
  const [year, month, day] = appDateTuple(value);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

function entrySeconds(entry: TimeEntry, now: Date) {
  if (entry.status === "running" && !entry.stopped_at) {
    return Math.max(0, Math.round((now.getTime() - new Date(entry.started_at).getTime()) / 1000));
  }
  return entry.duration_seconds;
}

export default function TimePage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timerBusy, setTimerBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const loadEntries = useCallback(async () => {
    const weekStart = startOfWeekMonday();
    const nextWeek = startOfNextWeek(weekStart);
    const [entriesRes, runningRes] = await Promise.all([
      fetch(`/api/time/entries?from=${weekStart.toISOString()}&to=${nextWeek.toISOString()}`),
      fetch("/api/time/running"),
    ]);
    if (!entriesRes.ok) throw new Error(await readError(entriesRes, t("time.couldNotLoad")));
    if (!runningRes.ok) throw new Error(await readError(runningRes, t("time.couldNotLoad")));
    const data = (await entriesRes.json()) as { items?: TimeEntry[] };
    const runningData = (await runningRes.json()) as { entry?: TimeEntry | null };
    setEntries(mergeRunningEntry(data.items ?? [], runningData.entry ?? null));
  }, [t]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    loadEntries()
      .catch((err) => {
        logError("time:load-entries", err);
        toast.error(err instanceof Error ? err.message : t("time.couldNotLoad"));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [loadEntries, t]);

  const todayIdx = dayIndex(now);
  const runningEntry = useMemo(
    () => entries.find((entry) => entry.status === "running" && !entry.stopped_at) ?? null,
    [entries],
  );
  const runningSeconds = runningEntry ? entrySeconds(runningEntry, now) : 0;
  const activeTimerLabel =
    runningEntry?.description ||
    runningEntry?.task?.title ||
    runningEntry?.project?.name ||
    t("time.unspecifiedWork");

  const totals = useMemo(() => {
    const perDay = Array.from({ length: 7 }, () => 0);
    const perProject = new Map<string, number>();
    const [todayYear, todayMonth, todayDay] = appDateTuple(now);
    const todayStart = appDateTimeToUtc(todayYear, todayMonth, todayDay);
    const tomorrowStart = appDateTimeToUtc(todayYear, todayMonth, todayDay + 1);

    entries.forEach((entry) => {
      const seconds = entrySeconds(entry, now);
      const idx = dayIndex(entry.started_at);
      perDay[idx] += seconds;
      const project = entry.project?.name ?? t("time.noProject");
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
  }, [entries, now, t]);

  const maxDayMinutes = Math.max(1, ...totals.perDay.map((seconds) => Math.round(seconds / 60)));

  const handleStartTimer = async () => {
    setTimerBusy(true);
    try {
      const res = await fetch("/api/time/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: t("time.quickTimerDescription") }),
      });
      if (!res.ok) throw new Error(await readError(res, t("time.couldNotStart")));
      const entry = (await res.json()) as TimeEntry;
      setEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id && item.status !== "running")]);
      toast.success(t("time.timerStarted"));
      await loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("time.couldNotStart"));
    } finally {
      setTimerBusy(false);
    }
  };

  const handleStopTimer = async () => {
    if (!runningEntry) return;
    setTimerBusy(true);
    try {
      const res = await fetch("/api/time/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: runningEntry.id }),
      });
      if (!res.ok) throw new Error(await readError(res, t("time.couldNotStop")));
      const entry = (await res.json()) as TimeEntry;
      setEntries((current) => current.map((item) => (item.id === entry.id ? entry : item)));
      toast.success(t("time.timerStopped"));
      await loadEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("time.couldNotStop"));
    } finally {
      setTimerBusy(false);
    }
  };

  return (
    <>
      <Header title={t("time.title")} />
      <div className="space-y-6 overflow-x-hidden p-4 sm:p-6">
        <section className="glass rounded-2xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {runningEntry ? t("time.timerRunning") : t("time.readyToTrack")}
              </p>
              <h2 className="mt-2 font-mono text-4xl font-bold tabular-nums text-foreground">
                {fmtElapsed(runningSeconds)}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {runningEntry
                  ? t("time.trackingNow", { item: activeTimerLabel })
                  : t("time.startHint")}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-shrink-0">
              <button
                type="button"
                onClick={handleStartTimer}
                disabled={Boolean(runningEntry) || timerBusy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {timerBusy && !runningEntry ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t("time.startTimer")}
              </button>
              <button
                type="button"
                onClick={handleStopTimer}
                disabled={!runningEntry || timerBusy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-upflow-danger px-5 text-sm font-semibold text-white shadow-sm shadow-upflow-danger/25 transition hover:bg-upflow-danger/90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {timerBusy && runningEntry ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {t("time.stopTimer")}
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            label={t("time.thisWeek")}
            value={fmtHM(totals.weekMinutes)}
            icon={<Clock className="w-4 h-4" />}
          />
          <SummaryCard
            label={t("time.today")}
            value={fmtHM(totals.todayMinutes)}
            icon={<CalendarIcon className="w-4 h-4" />}
          />
          <SummaryCard
            label={t("time.dailyAverage")}
            value={fmtHM(totals.averageMinutes)}
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("time.weeklyHours")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("time.savedEntriesHint")}
              </p>
            </div>
          </div>
          <div className="flex items-end gap-3 h-40 pl-2">
            {DAY_LABEL_KEYS.map((labelKey, idx) => {
              const label = t(labelKey);
              const mins = Math.round(totals.perDay[idx] / 60);
              const heightPct = (mins / maxDayMinutes) * 100;
              const isToday = idx === todayIdx;
              return (
                <div key={labelKey} className="flex-1 flex flex-col items-center gap-2">
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
              <h3 className="text-sm font-semibold text-foreground">{t("time.byProject")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("time.projectHint")}
              </p>
            </div>
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
          </div>
          {loading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">{t("common.loading")}</p>
          ) : totals.perProject.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {t("time.noTrackedTime")}
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
