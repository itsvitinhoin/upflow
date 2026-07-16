"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Users2 } from "lucide-react";
import { toast } from "sonner";
import type { CalendarEvent, TeamMember, TimeEntry } from "@/lib/types";
import { appTimeInputValue, cn, formatLongDate, formatTime, getInitials } from "@/lib/utils";
import type { Language } from "@/lib/i18n/translations";
import { sameLocalDate } from "@/components/dashboard/dashboard-utils";
import { useLanguage } from "@/components/language-provider";

type TimelineBlock = {
  start: number;
  end: number;
  label: string;
  startLabel: string;
  endLabel: string;
  kind: "meeting" | "tracked_time";
};

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function timelineHourLabel(hour: number, language: Language) {
  if (language === "pt-BR") return `${String(hour).padStart(2, "0")}:00`;
  return `${hour % 12 || 12} ${hour >= 12 ? "PM" : "AM"}`;
}

function decimalHour(value: string) {
  const [hours, minutes] = appTimeInputValue(value).split(":").map(Number);
  return hours + minutes / 60;
}

function clampTimelineBlock(start: number, end: number): TimelineBlock | null {
  const clampedStart = Math.max(8, Math.min(19, start));
  const clampedEnd = Math.max(clampedStart + 0.25, Math.min(19, end));
  if (clampedEnd <= 8 || clampedStart >= 19) return null;
  return {
    start: clampedStart,
    end: clampedEnd,
    label: "",
    startLabel: "",
    endLabel: "",
    kind: "meeting",
  };
}

function buildTimelineRowsFromData(
  users: TeamMember[],
  timeEntries: TimeEntry[],
  events: CalendarEvent[],
  t: Translate,
  locale: string,
) {
  const today = new Date();
  const colors = [
    "bg-primary/40 border-l-primary",
    "bg-upflow-success/30 border-l-upflow-success",
    "bg-upflow-warning/30 border-l-upflow-warning",
    "bg-upflow-danger/30 border-l-upflow-danger",
  ];

  return users.slice(0, 5).map((user, index) => {
    const blocks: TimelineBlock[] = [];

    timeEntries
      .filter(
        (entry) =>
          entry.user_id === user.id &&
          sameLocalDate(new Date(entry.started_at), today),
      )
      .forEach((entry) => {
        const start = decimalHour(entry.started_at);
        const end = entry.stopped_at
          ? decimalHour(entry.stopped_at)
          : decimalHour(new Date().toISOString());
        const block = clampTimelineBlock(start, end);
        if (block) {
          blocks.push({
            ...block,
            label: entry.project?.name ?? t("timeline.trackedTime"),
            startLabel: formatTime(entry.started_at, locale),
            endLabel: entry.stopped_at ? formatTime(entry.stopped_at, locale) : formatTime(new Date(), locale),
            kind: "tracked_time",
          });
        }
      });

    events
      .filter((event) => {
        if (!sameLocalDate(new Date(event.starts_at), today)) return false;
        if (event.created_by === user.id) return true;
        return event.attendees?.some((attendee) => attendee.user_id === user.id);
      })
      .forEach((event) => {
        const start = decimalHour(event.starts_at);
        const end = event.ends_at ? decimalHour(event.ends_at) : start + 0.5;
        const block = clampTimelineBlock(start, end);
        if (block) {
          blocks.push({
            ...block,
            label: event.title,
            startLabel: formatTime(event.starts_at, locale),
            endLabel: event.ends_at
              ? formatTime(event.ends_at, locale)
              : formatTime(new Date(new Date(event.starts_at).getTime() + 30 * 60 * 1000), locale),
            kind: "meeting",
          });
        }
      });

    return {
      user,
      blocks: blocks.sort((a, b) => a.start - b.start),
      color: colors[index % colors.length],
    };
  });
}

export function TeamTimeline({
  users,
  loading,
  timeEntries,
  events,
}: {
  users: TeamMember[];
  loading: boolean;
  timeEntries: TimeEntry[];
  events: CalendarEvent[];
}) {
  const { language, t } = useLanguage();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const focusedLabel = null as string | null;
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i);
  const totalHours = 11;
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [todayLabel, setTodayLabel] = useState<string>("");
  const [focusHour, setFocusHour] = useState<number | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    setCurrentHour(now.getHours());
    setTodayLabel(formatLongDate(now, locale));
  }, [locale]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
      }
    }
    if (optionsOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [optionsOpen]);

  const rows = useMemo(
    () => buildTimelineRowsFromData(users, timeEntries, events, t, locale),
    [users, timeEntries, events, t, locale],
  );
  const scheduledBlocks = rows.reduce((sum, row) => sum + row.blocks.length, 0);

  const inFocusWindow = (h: number) =>
    focusHour !== null && Math.abs(h - focusHour) <= 2;

  return (
    <section className="command-section-panel relative overflow-hidden rounded-[1.4rem] p-4 sm:p-5">
      <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-primary via-violet-400 to-upflow-success opacity-80 shadow-[0_0_28px_rgba(99,102,241,0.75)]" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-[0_0_24px_rgba(99,102,241,0.28)]">
              <Users2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                {t("timeline.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("timeline.subtitle")}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            <span suppressHydrationWarning>{todayLabel || "\u00A0"}</span>
            {focusedLabel && (
              <>
                {" - "}
                <span className="text-primary">
                  {t("timeline.showing", { label: focusedLabel.toLowerCase() })}
                </span>
              </>
            )}
            {focusHour !== null && (
              <>
                {" - "}
                <button
                  onClick={() => setFocusHour(null)}
                  className="text-primary hover:underline"
                >
                  {t("timeline.clearFocus")}
                </button>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-muted-foreground">
            {t("timeline.peopleCount", { count: rows.length })}
          </span>
          <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.14)]">
            {t("timeline.blocksCount", { count: scheduledBlocks })}
          </span>
          <div className="relative" ref={optionsRef}>
            <button
              onClick={() => setOptionsOpen((v) => !v)}
              aria-label={t("timeline.options")}
              aria-expanded={optionsOpen}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {optionsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg text-xs glass-strong"
              >
                <button
                  role="menuitem"
                  type="button"
                  disabled={focusHour === null}
                  onClick={() => {
                    setFocusHour(null);
                    setOptionsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/5 disabled:opacity-40 focus:outline-none focus-visible:bg-white/10"
                >
                  {t("timeline.clearFocusWindow")}
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setCompact((v) => !v);
                    setOptionsOpen(false);
                  }}
                  className="w-full border-t border-white/5 px-3 py-2 text-left hover:bg-white/5 focus:outline-none focus-visible:bg-white/10"
                >
                  {compact ? t("timeline.comfortableDensity") : t("timeline.compactDensity")}
                </button>
                <Link
                  role="menuitem"
                  href="/team"
                  onClick={() => setOptionsOpen(false)}
                  className="block w-full border-t border-white/5 px-3 py-2 text-left hover:bg-white/5 focus:outline-none focus-visible:bg-white/10"
                >
                  {t("timeline.openTeamPage")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-3 sm:pl-[132px]">
        {hours.map((h) => {
          const isCurrent = h === currentHour;
          const isFocus = focusHour === h;
          const inWindow = inFocusWindow(h);
          return (
            <button
              key={h}
              onClick={() => setFocusHour((f) => (f === h ? null : h))}
              aria-pressed={isFocus}
              title={t("timeline.focusAround", { hour: timelineHourLabel(h, language) })}
              className={cn(
                "min-w-[48px] flex-1 rounded-xl px-2 py-2 text-center text-xs font-medium transition-all hover:text-foreground",
                isFocus
                  ? "bg-primary text-primary-foreground shadow-[0_0_24px_rgba(99,102,241,0.45)] ring-2 ring-primary/60"
                  : isCurrent
                    ? "bg-primary/80 text-primary-foreground shadow-[0_0_20px_rgba(99,102,241,0.32)]"
                    : inWindow
                      ? "bg-primary/20 text-foreground"
                      : "bg-white/[0.06] text-muted-foreground hover:bg-white/10",
              )}
            >
              {timelineHourLabel(h, language)}
            </button>
          );
        })}
      </div>

      <div className={cn("mt-2", compact ? "space-y-1" : "space-y-2")}>
        {loading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {t("timeline.loading")}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {t("timeline.noTeammates")}
          </div>
        ) : (
          rows.map(({ user: u, blocks, color }) => {
            const rowMatches = focusedLabel
              ? blocks.some((b) => b.label === focusedLabel)
              : true;
            return (
              <button
                key={u.id}
                onClick={() => toast(t("timeline.openSchedule", { name: u.name }))}
                className={cn(
                  "-mx-1 flex w-full items-center gap-3 rounded-xl p-1 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  !rowMatches && "opacity-30",
                )}
              >
                <div className="flex w-[104px] flex-shrink-0 items-center gap-2 sm:w-[120px]">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary shadow-[0_0_18px_rgba(99,102,241,0.18)]">
                    {getInitials(u.name)}
                  </div>
                  <span className="truncate text-left text-xs text-foreground">
                    {u.name}
                  </span>
                </div>
                <div
                  className={cn(
                    "relative flex-1 overflow-visible rounded-xl border border-white/5 bg-white/[0.06]",
                    compact ? "h-6" : "h-9",
                  )}
                >
                  <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-12">
                    {hours.map((h) => (
                      <div
                        key={h}
                        className={cn(
                          "border-r border-white/5 transition-colors last:border-r-0",
                          h === currentHour && "bg-primary/10",
                          focusHour !== null &&
                            inFocusWindow(h) &&
                            "bg-primary/15",
                          focusHour !== null &&
                            !inFocusWindow(h) &&
                            "opacity-50",
                        )}
                      />
                    ))}
                  </div>
                  {blocks.map((b, i) => {
                    const dimByLabel =
                      focusedLabel !== null && b.label !== focusedLabel;
                    const dimByHour =
                      focusHour !== null &&
                      !(b.start <= focusHour + 2 && b.end >= focusHour - 2);
                    const timeRange = t("timeline.timeRange", {
                      start: b.startLabel,
                      end: b.endLabel,
                    });
                    const tooltip = `${u.name} - ${b.label} - ${timeRange}`;
                    return (
                      <div
                        key={i}
                        aria-label={tooltip}
                        className={cn(
                          "group absolute bottom-1 top-1 flex items-center rounded-md border-l-2 px-2 text-[10px] font-medium text-foreground/90 shadow-[0_0_18px_rgba(59,130,246,0.18)] transition-opacity",
                          color,
                          (dimByLabel || dimByHour) && "opacity-30",
                        )}
                        style={{
                          left: `calc(${((b.start - 8) / totalHours) * 100}% + 2px)`,
                          width: `calc(${Math.max(
                            ((b.end - b.start) / totalHours) * 100,
                            4,
                          )}% - 4px)`,
                        }}
                      >
                        <span className="min-w-0 truncate">{b.label}</span>
                        <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 hidden min-w-64 max-w-96 -translate-x-1/2 rounded-lg border border-border bg-popover/95 px-3 py-2 text-left text-[11px] font-medium text-popover-foreground shadow-lg backdrop-blur-xl group-hover:block group-focus-within:block dark:border-blue-300/20 dark:bg-[#070b18]/95 dark:shadow-[0_18px_46px_rgba(0,0,0,0.5)]">
                          <span className="block truncate text-blue-100">{b.label}</span>
                          <span className="mt-0.5 block text-muted-foreground">
                            {u.name} - {timeRange}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
