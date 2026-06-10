"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Users2 } from "lucide-react";
import { toast } from "sonner";
import type { CalendarEvent, TeamMember, TimeEntry } from "@/lib/types";
import { cn, formatLongDate, getInitials } from "@/lib/utils";
import { sameLocalDate } from "@/components/dashboard/dashboard-utils";

type TimelineBlock = {
  start: number;
  end: number;
  label: string;
};

function decimalHour(value: string) {
  const date = new Date(value);
  return date.getHours() + date.getMinutes() / 60;
}

function clampTimelineBlock(start: number, end: number): TimelineBlock | null {
  const clampedStart = Math.max(8, Math.min(19, start));
  const clampedEnd = Math.max(clampedStart + 0.25, Math.min(19, end));
  if (clampedEnd <= 8 || clampedStart >= 19) return null;
  return { start: clampedStart, end: clampedEnd, label: "" };
}

function buildTimelineRowsFromData(
  users: TeamMember[],
  timeEntries: TimeEntry[],
  events: CalendarEvent[],
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
          blocks.push({ ...block, label: entry.project?.name ?? "Tracked time" });
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
        if (block) blocks.push({ ...block, label: event.title });
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
    setTodayLabel(formatLongDate(now));
  }, []);

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
    () => buildTimelineRowsFromData(users, timeEntries, events),
    [users, timeEntries, events],
  );
  const scheduledBlocks = rows.reduce((sum, row) => sum + row.blocks.length, 0);

  const inFocusWindow = (h: number) =>
    focusHour !== null && Math.abs(h - focusHour) <= 2;

  return (
    <section className="glass relative overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-primary to-upflow-success" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300">
              <Users2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Team timeline
              </h3>
              <p className="text-xs text-muted-foreground">
                Live schedule from meetings and tracked time
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            <span suppressHydrationWarning>{todayLabel || "\u00A0"}</span>
            {focusedLabel && (
              <>
                {" - "}
                <span className="text-primary">
                  Showing {focusedLabel.toLowerCase()}s
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
                  Clear focus
                </button>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground">
            {rows.length} people
          </span>
          <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300">
            {scheduledBlocks} blocks
          </span>
          <div className="relative" ref={optionsRef}>
            <button
              onClick={() => setOptionsOpen((v) => !v)}
              aria-label="Timeline options"
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
                  Clear focus window
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
                  {compact ? "Comfortable density" : "Compact density"}
                </button>
                <Link
                  role="menuitem"
                  href="/team"
                  onClick={() => setOptionsOpen(false)}
                  className="block w-full border-t border-white/5 px-3 py-2 text-left hover:bg-white/5 focus:outline-none focus-visible:bg-white/10"
                >
                  Open team page
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
              title={`Focus around ${
                h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`
              }`}
              className={cn(
                "min-w-[44px] flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium transition-all hover:text-foreground",
                isFocus
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/60"
                  : isCurrent
                    ? "bg-primary/80 text-primary-foreground"
                    : inWindow
                      ? "bg-primary/20 text-foreground"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10",
              )}
            >
              {h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}
            </button>
          );
        })}
      </div>

      <div className={cn("mt-2", compact ? "space-y-1" : "space-y-2")}>
        {loading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No teammates to show
          </div>
        ) : (
          rows.map(({ user: u, blocks, color }) => {
            const rowMatches = focusedLabel
              ? blocks.some((b) => b.label === focusedLabel)
              : true;
            return (
              <button
                key={u.id}
                onClick={() => toast(`Open ${u.name}'s schedule`)}
                className={cn(
                  "-mx-1 flex w-full items-center gap-3 rounded-lg p-1 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  !rowMatches && "opacity-30",
                )}
              >
                <div className="flex w-[104px] flex-shrink-0 items-center gap-2 sm:w-[120px]">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    {getInitials(u.name)}
                  </div>
                  <span className="truncate text-left text-xs text-foreground">
                    {u.name}
                  </span>
                </div>
                <div
                  className={cn(
                    "relative flex-1 overflow-hidden rounded-lg bg-white/5",
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
                    const fmtH = (n: number) =>
                      n > 12 ? `${n - 12}pm` : n === 12 ? "12pm" : `${n}am`;
                    const dimByLabel =
                      focusedLabel !== null && b.label !== focusedLabel;
                    const dimByHour =
                      focusHour !== null &&
                      !(b.start <= focusHour + 2 && b.end >= focusHour - 2);
                    return (
                      <div
                        key={i}
                        title={`${u.name} - ${b.label} - ${fmtH(b.start)} to ${fmtH(b.end)}`}
                        className={cn(
                          "absolute bottom-1 top-1 flex items-center truncate rounded-md border-l-2 px-2 text-[10px] font-medium text-foreground/80 transition-opacity",
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
                        {b.label}
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
