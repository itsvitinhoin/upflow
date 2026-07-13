"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DoorOpen,
  Plus,
  RefreshCw,
  Users,
  Video,
} from "lucide-react";
import Header from "@/components/layout/header";
import ScheduleMeetingDialog from "@/components/dashboard/schedule-meeting-dialog";
import { useLanguage } from "@/components/language-provider";
import { appDateKey, cn, formatLongDate, formatTime, mergeAppDateAndTime } from "@/lib/utils";
import { logError } from "@/lib/log-error";
import type { CalendarEvent } from "@/lib/types";

const ROOM_NAME = "Sala de Reuniao";
const DEFAULT_SLOT_MINUTES = 30;
const DAY_CELL_VISIBLE_ITEM_LIMIT = 4;
const WEEKDAY_KEYS = [
  "time.day.mon",
  "time.day.tue",
  "time.day.wed",
  "time.day.thu",
  "time.day.fri",
  "time.day.sat",
  "time.day.sun",
];

type RoomCalendarEvent = CalendarEvent & {
  creator?: { id: string; name: string | null; email: string } | null;
};

function dateKey(input: Date | string) {
  return appDateKey(input);
}

function startOfMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const dow = first.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  return new Date(year, month, 1 - offset);
}

function normalizeRoom(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isMeetingRoomEvent(event: RoomCalendarEvent) {
  const location = normalizeRoom(event.location);
  return (
    event.type === "meeting" &&
    (location.includes("sala de reuniao") || location.includes("meeting room"))
  );
}

function eventEnd(event: RoomCalendarEvent) {
  const start = new Date(event.starts_at);
  if (event.ends_at) return new Date(event.ends_at);
  return new Date(start.getTime() + DEFAULT_SLOT_MINUTES * 60 * 1000);
}

function hasOverlap(a: RoomCalendarEvent, b: RoomCalendarEvent) {
  const aStart = new Date(a.starts_at).getTime();
  const aEnd = eventEnd(a).getTime();
  const bStart = new Date(b.starts_at).getTime();
  const bEnd = eventEnd(b).getTime();
  return aStart < bEnd && bStart < aEnd;
}

function conflictIds(events: RoomCalendarEvent[]) {
  const ids = new Set<string>();
  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      if (dateKey(events[i].starts_at) !== dateKey(events[j].starts_at)) continue;
      if (!hasOverlap(events[i], events[j])) continue;
      ids.add(events[i].id);
      ids.add(events[j].id);
    }
  }
  return ids;
}

function personName(person?: { name: string | null; email: string } | null) {
  return person?.name || person?.email || "Team";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function eventPeople(event: RoomCalendarEvent) {
  const names = [
    personName(event.creator),
    ...(event.attendees ?? []).map((attendee) => personName(attendee.user)),
  ];
  return Array.from(new Set(names.filter(Boolean)));
}

function eventRange(event: RoomCalendarEvent) {
  return `${formatTime(event.starts_at)} - ${formatTime(eventEnd(event))}`;
}

export default function MeetingRoomPage() {
  const { language, t } = useLanguage();
  const [today, setToday] = useState(() => new Date());
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<RoomCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const gridStart = useMemo(() => startOfMonthGrid(year, month), [month, year]);
  const gridEnd = useMemo(() => {
    const end = new Date(gridStart);
    end.setDate(gridStart.getDate() + 42);
    return end;
  }, [gridStart]);

  const loadRoomCalendar = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      try {
        const from = mergeAppDateAndTime(gridStart, "00:00").toISOString();
        const to = mergeAppDateAndTime(gridEnd, "23:59").toISOString();
        const res = await fetch(`/api/calendar/events?from=${from}&to=${to}`);
        if (!res.ok) throw new Error("Failed to load meeting room calendar");
        const data = (await res.json()) as { items?: RoomCalendarEvent[]; events?: RoomCalendarEvent[] };
        const roomEvents = (data.items ?? data.events ?? [])
          .filter(isMeetingRoomEvent)
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        setEvents(roomEvents);
      } catch (err) {
        logError("meeting-room:load", err);
        toast.error(t("meetingRoom.loadFailed"));
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [gridEnd, gridStart, t],
  );

  useEffect(() => {
    void loadRoomCalendar();
  }, [loadRoomCalendar]);

  const days = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);
      return day;
    });
  }, [gridStart]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, RoomCalendarEvent[]>();
    events.forEach((event) => {
      const key = dateKey(event.starts_at);
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return map;
  }, [events]);

  const selectedKey = dateKey(selected);
  const todayKey = dateKey(today);
  const selectedEvents = eventsByDay.get(selectedKey) ?? [];
  const todaysEvents = eventsByDay.get(todayKey) ?? [];
  const conflicts = useMemo(() => conflictIds(events), [events]);
  const upcomingEvents = useMemo(
    () => events.filter((event) => eventEnd(event).getTime() >= today.getTime()),
    [events, today],
  );
  const nextEvent = upcomingEvents[0] ?? null;
  const monthTitle = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
  }).format(cursor);

  const goPrev = () => {
    const next = new Date(year, month - 1, 1);
    setCursor(next);
    setSelected(next);
  };
  const goNext = () => {
    const next = new Date(year, month + 1, 1);
    setCursor(next);
    setSelected(next);
  };
  const goToday = () => {
    const now = new Date();
    setToday(now);
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(now);
  };

  const handleScheduled = (event: CalendarEvent) => {
    const roomEvent = event as RoomCalendarEvent;
    if (isMeetingRoomEvent(roomEvent)) {
      setEvents((prev) =>
        [...prev, roomEvent].sort(
          (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        ),
      );
    }
    setSelected(new Date(event.starts_at));
    void loadRoomCalendar({ silent: true });
  };

  return (
    <>
      <Header title={t("meetingRoom.title")} />
      <main className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <section className="overflow-hidden rounded-2xl border border-blue-300/15 bg-[#070c1a]/88 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-blue-200/60">
                {t("meetingRoom.eyebrow")}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
                {t("meetingRoom.title")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("meetingRoom.subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadRoomCalendar()}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-foreground transition hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
                {t("common.refresh")}
              </button>
              <button
                type="button"
                onClick={() => setShowSchedule(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                {t("meetingRoom.reserveRoom")}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CalendarDays}
              label={t("meetingRoom.todayBookings")}
              value={loading ? "..." : String(todaysEvents.length)}
              detail={t("meetingRoom.todayBookingsDetail")}
            />
            <MetricCard
              icon={Clock3}
              label={t("meetingRoom.nextBooking")}
              value={nextEvent ? formatTime(nextEvent.starts_at) : t("common.none")}
              detail={nextEvent ? nextEvent.title : t("meetingRoom.noUpcomingBookings")}
            />
            <MetricCard
              icon={AlertTriangle}
              label={t("meetingRoom.conflicts")}
              value={loading ? "..." : String(conflicts.size)}
              detail={conflicts.size > 0 ? t("meetingRoom.conflictsDetail") : t("meetingRoom.noConflicts")}
              tone={conflicts.size > 0 ? "warning" : "success"}
            />
            <MetricCard
              icon={DoorOpen}
              label={t("meetingRoom.monthBookings")}
              value={loading ? "..." : String(events.length)}
              detail={monthTitle}
            />
          </div>
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-2xl p-4 glass sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{monthTitle}</h2>
                <p className="text-xs text-muted-foreground">{t("meetingRoom.calendarHint")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={goToday}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-foreground transition-colors"
                >
                  {t("calendar.today")}
                </button>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label={t("calendar.previousMonth")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label={t("calendar.nextMonth")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {WEEKDAY_KEYS.map((dayKey) => (
                <div key={dayKey} className="px-2 py-1 text-center">
                  {t(dayKey)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const key = dateKey(day);
                const dayEvents = eventsByDay.get(key) ?? [];
                const isSelected = key === selectedKey;
                const isToday = key === todayKey;
                const inMonth = day.getMonth() === month;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(day)}
                    className={cn(
                      "min-h-[112px] rounded-xl border p-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      isSelected
                        ? "border-primary/70 bg-primary/12 shadow-[0_0_28px_rgba(59,130,246,0.16)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
                      !inMonth && "opacity-45",
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 text-xs font-semibold",
                          isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                        )}
                      >
                        {day.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-100">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, DAY_CELL_VISIBLE_ITEM_LIMIT).map((event) => (
                        <span
                          key={event.id}
                          className={cn(
                            "block truncate rounded-md border-l-2 px-2 py-1 text-[10px] font-medium",
                            conflicts.has(event.id)
                              ? "border-l-upflow-warning bg-upflow-warning/15 text-upflow-warning"
                              : "border-l-primary bg-primary/15 text-sky-100",
                          )}
                        >
                          {formatTime(event.starts_at)} {event.title}
                        </span>
                      ))}
                      {dayEvents.length > DAY_CELL_VISIBLE_ITEM_LIMIT && (
                        <span className="block text-[10px] text-muted-foreground">
                          {t("calendar.more", { count: dayEvents.length - DAY_CELL_VISIBLE_ITEM_LIMIT })}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl p-4 glass sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("meetingRoom.selectedDay")}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">
                    {formatLongDate(selected)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSchedule(true)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("meetingRoom.book")}
                </button>
              </div>
              <div className="mt-4">
                {loading ? (
                  <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
                ) : selectedEvents.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-6 text-center">
                    <DoorOpen className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">{t("meetingRoom.roomAvailable")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("meetingRoom.noBookingsSelectedDay")}</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {selectedEvents.map((event) => (
                      <MeetingItem
                        key={event.id}
                        event={event}
                        hasConflict={conflicts.has(event.id)}
                        t={t}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-2xl p-4 glass sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("meetingRoom.allBookings")}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">{t("meetingRoom.monthAgenda")}</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground">
                  {events.length}
                </span>
              </div>
              {loading ? (
                <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
              ) : events.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-xs text-muted-foreground">
                  {t("meetingRoom.noBookingsMonth")}
                </p>
              ) : (
                <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {events.map((event) => (
                    <MeetingItem
                      key={event.id}
                      event={event}
                      compact
                      hasConflict={conflicts.has(event.id)}
                      t={t}
                    />
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </main>

      <ScheduleMeetingDialog
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        onScheduled={handleScheduled}
        initialDate={selected}
        initialTime="09:00"
        title={t("meetingRoom.reserveRoom")}
        defaultType="meeting"
        defaultLocation={ROOM_NAME}
      />
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100/60">
          {label}
        </p>
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "success" && "text-upflow-success",
            tone === "warning" && "text-upflow-warning",
            tone === "default" && "text-primary",
          )}
        />
      </div>
      <p className="mt-3 text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MeetingItem({
  event,
  compact = false,
  hasConflict,
  t,
}: {
  event: RoomCalendarEvent;
  compact?: boolean;
  hasConflict: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const people = eventPeople(event);
  const primaryPerson = people[0] ?? "Team";
  const detailDate = compact ? formatLongDate(event.starts_at) : null;
  return (
    <li
      className={cn(
        "rounded-xl border bg-white/[0.035] p-3",
        hasConflict ? "border-upflow-warning/35" : "border-white/10",
      )}
    >
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xs font-bold text-primary">
          {initials(primaryPerson)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{event.title}</p>
            {hasConflict && (
              <span className="inline-flex items-center gap-1 rounded-full border border-upflow-warning/30 bg-upflow-warning/10 px-2 py-0.5 text-[10px] font-semibold text-upflow-warning">
                <AlertTriangle className="h-3 w-3" />
                {t("meetingRoom.conflict")}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {eventRange(event)}
            </span>
            {detailDate && <span>{detailDate}</span>}
            <span className="inline-flex min-w-0 items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span className="truncate">{people.join(", ")}</span>
            </span>
          </div>
          {event.description && (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{event.description}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-sky-100">
              <Video className="h-3 w-3" />
              {event.location || ROOM_NAME}
            </span>
            <Link
              href={`/calendar?date=${dateKey(event.starts_at)}&event=${event.id}`}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
            >
              {t("common.open")}
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
