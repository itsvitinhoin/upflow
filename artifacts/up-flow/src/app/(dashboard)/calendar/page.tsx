"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import { logError } from "@/lib/log-error";
import { Bell, Calendar as CalendarIcon, CheckSquare, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Video, X } from "lucide-react";
import { appDateKey, appTimeInputValue, cn, formatLongDate, formatTime, mergeAppDateAndTime } from "@/lib/utils";
import type { CalendarEvent, Task } from "@/lib/types";
import ScheduleMeetingDialog from "@/components/dashboard/schedule-meeting-dialog";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import { useLanguage } from "@/components/language-provider";

const WEEKDAY_KEYS = [
  "time.day.mon",
  "time.day.tue",
  "time.day.wed",
  "time.day.thu",
  "time.day.fri",
  "time.day.sat",
  "time.day.sun",
];

function isSameDay(a: Date, b: Date) {
  return appDateKey(a) === appDateKey(b);
}

function dateKey(input: Date | string) {
  return appDateKey(input);
}

function startOfMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const dow = first.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  return new Date(year, month, 1 - offset);
}

function eventTime(event: CalendarEvent) {
  return formatTime(event.starts_at);
}

function toTimeInput(value: string) {
  return appTimeInputValue(value);
}

function mergeSelectedDate(selected: Date, time: string) {
  return mergeAppDateAndTime(selected, time);
}

const taskColor: Record<Task["priority"], string> = {
  low: "bg-upflow-success/30 text-upflow-success border-l-upflow-success",
  medium: "bg-primary/30 text-primary border-l-primary",
  high: "bg-upflow-danger/30 text-upflow-danger border-l-upflow-danger",
};

export default function CalendarPage() {
  const { language, t } = useLanguage();
  const [today, setToday] = useState(() => new Date());
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date>(today);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState<"meeting" | "reminder">("meeting");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [manageEvents, setManageEvents] = useState(false);

  useEffect(() => {
    const refreshToday = () => setToday(new Date());
    const interval = window.setInterval(refreshToday, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshToday();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const gridStart = startOfMonthGrid(year, month);
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 42);

  const loadCalendar = () => {
    setLoading(true);
    const from = mergeAppDateAndTime(gridStart, "00:00").toISOString();
    const to = mergeAppDateAndTime(gridEnd, "23:59").toISOString();
    Promise.all([
      fetch("/api/tasks?mine=true").then((r) => r.json()),
      fetch(`/api/calendar/events?from=${from}&to=${to}`).then((r) => r.json()),
    ])
      .then(([taskData, eventData]) => {
        const taskList = (Array.isArray(taskData) ? taskData : taskData.items ?? taskData.tasks ?? []) as Task[];
        const eventList = (eventData.items ?? eventData.events ?? []) as CalendarEvent[];
        setTasks(taskList);
        setEvents(eventList);
      })
      .catch((err) => logError("calendar:load", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (!task.due_date) return;
      const key = dateKey(task.due_date);
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    return map;
  }, [tasks]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = dateKey(event.starts_at);
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return map;
  }, [events]);

  const selectedKey = dateKey(selected);
  const selectedTasks = tasksByDay.get(selectedKey) ?? [];
  const selectedEvents = eventsByDay.get(selectedKey) ?? [];
  const selectedIsToday = isSameDay(selected, today);
  const monthTitle = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
  }).format(cursor);

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => {
    const now = new Date();
    setToday(now);
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(now);
  };

  const openSchedule = (type: "meeting" | "reminder") => {
    setQuickCreateOpen(false);
    setScheduleType(type);
    setShowSchedule(true);
  };

  const openTaskDialog = () => {
    setQuickCreateOpen(false);
    setShowNewTask(true);
  };

  const deleteEvent = async (event: CalendarEvent) => {
    if (!confirm(t("calendar.deleteConfirm", { title: event.title }))) return;
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, { method: "DELETE" });
      if (res.status === 403) {
        toast.error(t("calendar.noPermission"));
        return;
      }
      if (!res.ok) throw new Error("Failed to delete event");
      setEvents((prev) => prev.filter((item) => item.id !== event.id));
      toast.success(t("calendar.eventDeleted"));
    } catch {
      toast.error(t("calendar.couldNotDelete"));
    }
  };

  return (
    <>
      <Header title={t("calendar.title")} />
      <div className="grid grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-2xl p-4 glass sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {monthTitle}
            </h3>
            <div className="flex flex-wrap items-center gap-1">
              <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
                <button
                  type="button"
                  onClick={() => setManageEvents(false)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-colors",
                    !manageEvents ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("calendar.view")}
                </button>
                <button
                  type="button"
                  onClick={() => setManageEvents(true)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-colors",
                    manageEvents ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("calendar.manage")}
                </button>
              </div>
              {manageEvents && (
                <button
                  onClick={() => openSchedule("reminder")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("calendar.newEvent")}
                </button>
              )}
              <button
                onClick={goToday}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-foreground transition-colors"
              >
                {t("calendar.today")}
              </button>
              <button
                onClick={goPrev}
                aria-label={t("calendar.previousMonth")}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goNext}
                aria-label={t("calendar.nextMonth")}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            {WEEKDAY_KEYS.map((dayKey) => (
              <div key={dayKey} className="text-center py-1">{t(dayKey)}</div>
            ))}
          </div>

          <div className="grid min-w-0 grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = day.getMonth() === month;
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selected);
              const key = dateKey(day);
              const dayTasks = tasksByDay.get(key) ?? [];
              const dayEvents = eventsByDay.get(key) ?? [];
              return (
                <button
                  key={key}
                  onClick={() => setSelected(day)}
                  className={cn(
                    "flex h-16 flex-col items-start rounded-lg border p-1 text-left transition-colors sm:h-24 sm:p-1.5",
                    isSelected ? "border-primary/60 bg-primary/10" : "border-transparent hover:bg-white/5",
                    !inMonth && "opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isToday
                        ? "w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 hidden w-full space-y-0.5 overflow-hidden sm:block">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        title={event.title}
                        className={cn("truncate text-[10px] px-1 py-0.5 rounded border-l-2 border-l-primary", event.color || "bg-primary/20 text-primary")}
                      >
                        {eventTime(event)} {event.title}
                      </div>
                    ))}
                    {dayTasks.slice(0, 2).map((task) => (
                      <div
                        key={task.id}
                        title={task.title}
                        className={cn("truncate text-[10px] px-1 py-0.5 rounded border-l-2", taskColor[task.priority])}
                      >
                        {task.title}
                      </div>
                    ))}
                    {dayEvents.length + dayTasks.length > 4 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        {t("calendar.more", { count: dayEvents.length + dayTasks.length - 4 })}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl p-4 glass sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {selectedIsToday ? t("calendar.today") : t("common.selected")}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  {formatLongDate(selected)}
                </h3>
              </div>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setQuickCreateOpen((value) => !value)}
                  aria-expanded={quickCreateOpen}
                  aria-label={t("calendar.quickCreate")}
                  title={t("calendar.quickCreate")}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-blue-300/25 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_rgba(59,130,246,0.28)] transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t("calendar.quickCreateShort")}</span>
                </button>
                {quickCreateOpen && (
                  <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#070b18]/95 p-1 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => openSchedule("meeting")}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-white/10"
                    >
                      <Video className="h-3.5 w-3.5 text-upflow-success" />
                      {t("calendar.quickMeeting")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openSchedule("reminder")}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-white/10"
                    >
                      <Bell className="h-3.5 w-3.5 text-primary" />
                      {t("calendar.quickEvent")}
                    </button>
                    <button
                      type="button"
                      onClick={openTaskDialog}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-white/10"
                    >
                      <CheckSquare className="h-3.5 w-3.5 text-upflow-warning" />
                      {t("calendar.quickTask")}
                    </button>
                  </div>
                )}
              </div>
            </div>
            {manageEvents && (
              <button
                type="button"
                onClick={() => openSchedule("reminder")}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("calendar.newEventDate")}
              </button>
            )}

            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                {t("calendar.events")}
              </p>
              {loading ? (
                <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
              ) : selectedEvents.length === 0 ? (
                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-4 text-center">
                  <p className="text-xs text-muted-foreground">{t("calendar.noEvents")}</p>
                  {manageEvents && (
                    <button
                      type="button"
                      onClick={() => openSchedule("reminder")}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("calendar.addEvent")}
                    </button>
                  )}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {selectedEvents.map((event) => (
                    <li
                      key={event.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border-l-2 border-l-primary px-3 py-2 transition-colors",
                        event.color || "bg-primary/20 text-primary",
                        manageEvents ? "hover:bg-white/5" : "",
                      )}
                    >
                      <div
                        className={cn(
                          "min-w-0 flex-1 text-left",
                        )}
                      >
                        <p className="text-xs font-medium text-foreground truncate">
                          {eventTime(event)} {event.title}
                        </p>
                        {(event.location || event.meeting_url || event.description) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {event.location || event.meeting_url || event.description}
                          </p>
                        )}
                      </div>
                      {manageEvents && (
                        <div className="flex flex-shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingEvent(event)}
                            aria-label={`${t("common.updated")} ${event.title}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteEvent(event)}
                            aria-label={`${t("common.delete")} ${event.title}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-upflow-danger hover:bg-upflow-danger/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                {t("calendar.dueTasks")}
              </p>
              {loading ? (
                <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
              ) : selectedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("calendar.noDueTasks")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedTasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        href={task.project ? `/projects/${task.project.id}` : "#"}
                        className={cn("block px-3 py-2 rounded-lg border-l-2 hover:bg-white/5 transition-colors", taskColor[task.priority])}
                      >
                        <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                        {task.project?.name && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{task.project.name}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-4 glass sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("calendar.legend")}
              </p>
            </div>
            <ul className="text-xs space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-primary/40 border-l-2 border-l-primary" />
                {t("calendar.legendEvent")}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-upflow-danger/40 border-l-2 border-l-upflow-danger" />
                {t("calendar.legendHigh")}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-upflow-success/40 border-l-2 border-l-upflow-success" />
                {t("calendar.legendLow")}
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <ScheduleMeetingDialog
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        initialDate={selected}
        title={scheduleType === "meeting" ? t("calendar.quickMeeting") : t("calendar.quickEvent")}
        defaultType={scheduleType}
        onScheduled={(event) => {
          setEvents((prev) => [...prev, event].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()));
        }}
      />

      <NewTaskDialog
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        onCreated={() => {
          setShowNewTask(false);
          loadCalendar();
        }}
        defaultDueDate={appDateKey(selected)}
      />

      {editingEvent && (
        <EventEditor
          event={editingEvent}
          selected={selected}
          onClose={() => setEditingEvent(null)}
          onChanged={(event) => {
            setEvents((prev) => prev.map((item) => (item.id === event.id ? event : item)));
            setEditingEvent(null);
          }}
          onDeleted={(id) => {
            setEvents((prev) => prev.filter((item) => item.id !== id));
            setEditingEvent(null);
          }}
        />
      )}
    </>
  );
}

function EventEditor({
  event,
  selected,
  onClose,
  onChanged,
  onDeleted,
}: {
  event: CalendarEvent;
  selected: Date;
  onClose: () => void;
  onChanged: (event: CalendarEvent) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(event.title);
  const [time, setTime] = useState(toTimeInput(event.starts_at));
  const [location, setLocation] = useState(event.location ?? "");
  const [submitting, setSubmitting] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t("calendar.titleRequired"));
      return;
    }
    const startsAt = mergeSelectedDate(selected, time);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          location: location.trim() || null,
        }),
      });
      if (res.status === 403) {
        toast.error(t("calendar.noPermission"));
        return;
      }
      if (!res.ok) throw new Error("Failed to update event");
      onChanged((await res.json()) as CalendarEvent);
      toast.success(t("calendar.eventUpdated"));
    } catch {
      toast.error(t("calendar.couldNotUpdate"));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!confirm(t("calendar.deleteConfirm", { title: event.title }))) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, { method: "DELETE" });
      if (res.status === 403) {
        toast.error(t("calendar.noPermission"));
        return;
      }
      if (!res.ok) throw new Error("Failed to delete event");
      onDeleted(event.id);
      toast.success(t("calendar.eventDeleted"));
    } catch {
      toast.error(t("calendar.couldNotDelete"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">
            {t("calendar.manageEvent", {
              type: event.type === "meeting" ? t("calendar.meeting") : t("calendar.event"),
            })}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">{t("calendar.fieldTitle")}</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{t("calendar.fieldTime")}</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{t("calendar.fieldLocation")}</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="mt-6 grid gap-2 sm:flex">
          <button
            type="button"
            onClick={remove}
            disabled={submitting}
            className="flex h-10 items-center justify-center rounded-lg border border-upflow-danger/30 text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-40 sm:w-10"
            aria-label={t("calendar.couldNotDelete")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10 disabled:opacity-40"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 rounded-lg disabled:opacity-50"
          >
            {submitting ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
