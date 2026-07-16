"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import { logError } from "@/lib/log-error";
import { Bell, Calendar as CalendarIcon, Check, CheckSquare, ChevronLeft, ChevronRight, DoorOpen, Pencil, Plus, Trash2, Video, X } from "lucide-react";
import { appDateKey, appTimeInputValue, cn, formatLongDate, formatTime, mergeAppDateAndTime } from "@/lib/utils";
import type { CalendarEvent, Task } from "@/lib/types";
import ScheduleMeetingDialog from "@/components/dashboard/schedule-meeting-dialog";
import TaskCreateSheet from "@/components/projects/task-create-sheet";
import { useLanguage } from "@/components/language-provider";
import { useAppUser } from "@/components/user-provider";

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

function dateFromQueryParam(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (year && month && day) return new Date(year, month - 1, day);
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
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

const DEFAULT_EVENT_COLOR = "bg-primary/20 text-primary border-l-primary";
const COMPLETED_EVENT_COLOR = "bg-upflow-success/30 text-upflow-success border-l-upflow-success";
const ROOM_BOOKING_COLOR = "bg-cyan-400/20 text-cyan-100 border-l-cyan-400";
const ROOM_NAME = "Sala de Reuniao";
const DAY_CELL_VISIBLE_ITEM_LIMIT = 6;
const EVENT_COLOR_OPTIONS = [
  { key: "default", color: null, className: DEFAULT_EVENT_COLOR, labelKey: "calendar.colorDefault" },
  { key: "complete", color: COMPLETED_EVENT_COLOR, className: COMPLETED_EVENT_COLOR, labelKey: "calendar.colorComplete" },
  { key: "amber", color: "bg-upflow-warning/30 text-upflow-warning border-l-upflow-warning", className: "bg-upflow-warning/30 text-upflow-warning border-l-upflow-warning", labelKey: "calendar.colorWarning" },
  { key: "red", color: "bg-upflow-danger/30 text-upflow-danger border-l-upflow-danger", className: "bg-upflow-danger/30 text-upflow-danger border-l-upflow-danger", labelKey: "calendar.colorUrgent" },
] as const;

const USER_EVENT_TONES = [
  { chip: "border-sky-400/40 bg-sky-400/10 text-sky-700 dark:text-sky-100", dot: "bg-sky-400", event: "bg-sky-400/20 text-sky-800 border-l-sky-400 dark:text-sky-100" },
  { chip: "border-violet-400/40 bg-violet-400/10 text-violet-700 dark:text-violet-100", dot: "bg-violet-400", event: "bg-violet-400/20 text-violet-800 border-l-violet-400 dark:text-violet-100" },
  { chip: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100", dot: "bg-emerald-400", event: "bg-emerald-400/20 text-emerald-100 border-l-emerald-400" },
  { chip: "border-amber-400/40 bg-amber-400/10 text-amber-100", dot: "bg-amber-400", event: "bg-amber-400/20 text-amber-100 border-l-amber-400" },
  { chip: "border-rose-400/40 bg-rose-400/10 text-rose-100", dot: "bg-rose-400", event: "bg-rose-400/20 text-rose-100 border-l-rose-400" },
  { chip: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100", dot: "bg-cyan-400", event: "bg-cyan-400/20 text-cyan-100 border-l-cyan-400" },
] as const;

type SelectableUser = {
  id: string;
  name: string | null;
  email: string;
};

type ScheduleDefaults = {
  type: "meeting" | "reminder";
  title?: string;
  description?: string;
  taskId?: string | null;
  projectId?: string | null;
  time?: string;
  attendeeIds?: string[];
};

function eventColor(event: CalendarEvent) {
  return event.color || DEFAULT_EVENT_COLOR;
}

function normalizeRoom(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isMeetingRoomEvent(event: CalendarEvent) {
  const location = normalizeRoom(event.location);
  return (
    event.type === "meeting" &&
    (location.includes("sala de reuniao") || location.includes("meeting room"))
  );
}

function eventIsComplete(event: CalendarEvent) {
  return event.color === COMPLETED_EVENT_COLOR || event.color?.includes("upflow-success") || false;
}

function eventHasEnded(event: CalendarEvent, now: Date) {
  if (!event.ends_at) return false;
  return new Date(event.ends_at).getTime() <= now.getTime();
}

function eventDisplayState(event: CalendarEvent, now: Date) {
  const manuallyComplete = eventIsComplete(event);
  const automaticallyComplete = !manuallyComplete && eventHasEnded(event, now);
  const isComplete = manuallyComplete || automaticallyComplete;

  return {
    isComplete,
    isAutoComplete: automaticallyComplete,
    color: isComplete ? COMPLETED_EVENT_COLOR : eventColor(event),
  };
}

function eventUserIds(event: CalendarEvent) {
  return Array.from(
    new Set([
      event.created_by,
      ...(event.attendees ?? []).map((attendee) => attendee.user_id),
    ].filter(Boolean)),
  );
}

export default function CalendarPage() {
  const { language, t } = useLanguage();
  const user = useAppUser();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [eventMenu, setEventMenu] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null);
  const [people, setPeople] = useState<SelectableUser[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const selectedUserIds = useMemo(() => (selectedUserId ? new Set([selectedUserId]) : new Set<string>()), [selectedUserId]);
  const [scheduleDefaults, setScheduleDefaults] = useState<ScheduleDefaults | null>(null);

  useEffect(() => {
    const linkedDate = dateFromQueryParam(searchParams?.get("date") ?? null);
    if (linkedDate) {
      setSelected(linkedDate);
      setCursor(new Date(linkedDate.getFullYear(), linkedDate.getMonth(), 1));
    }

    const create = searchParams?.get("create");
    if (create !== "meeting" && create !== "event" && create !== "reminder") return;

    const type = create === "reminder" ? "reminder" : "meeting";
    const openDate = linkedDate ?? new Date();
    setScheduleType(type);
    setScheduleDefaults({
      type,
      title: searchParams?.get("title") ?? undefined,
      description: searchParams?.get("description") ?? undefined,
      taskId: searchParams?.get("task"),
      projectId: searchParams?.get("project"),
      attendeeIds: (searchParams?.get("attendees") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      time: searchParams?.get("time") ?? "09:00",
    });
    setSelected(openDate);
    setCursor(new Date(openDate.getFullYear(), openDate.getMonth(), 1));
    setShowSchedule(true);
    router.replace("/calendar", { scroll: false });
  }, [router, searchParams]);

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

  const loadCalendar = (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    const from = mergeAppDateAndTime(gridStart, "00:00").toISOString();
    const to = mergeAppDateAndTime(gridEnd, "23:59").toISOString();
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch(`/api/calendar/events?from=${from}&to=${to}`).then((r) => r.json()),
    ])
      .then(([taskData, eventData]) => {
        const taskList = (Array.isArray(taskData) ? taskData : taskData.items ?? taskData.tasks ?? []) as Task[];
        const eventList = (eventData.items ?? eventData.events ?? []) as CalendarEvent[];
        setTasks(taskList);
        setEvents(eventList);
      })
      .catch((err) => logError("calendar:load", err))
      .finally(() => {
        if (!options?.silent) setLoading(false);
      });
  };

  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  useEffect(() => {
    if (!user?.currentWorkspaceId) return;
    const controller = new AbortController();
    setPeopleLoading(true);
    fetch(`/api/users?workspace_id=${user.currentWorkspaceId}&status=active`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return { items: [] };
        return (await res.json()) as { items?: SelectableUser[] };
      })
      .then((data) => setPeople(data.items ?? []))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setPeople([]);
      })
      .finally(() => setPeopleLoading(false));

    return () => controller.abort();
  }, [user?.currentWorkspaceId]);

  useEffect(() => {
    const linkedEventId = searchParams?.get("event");
    if (!linkedEventId) return;
    const linkedEvent = events.find((event) => event.id === linkedEventId);
    if (!linkedEvent) return;
    setSelected(new Date(linkedEvent.starts_at));
    setEditingEvent(linkedEvent);
  }, [events, searchParams]);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const filteredTasks = useMemo(() => {
    if (selectedUserIds.size === 0) return tasks;
    return tasks.filter((task) => task.assignee_id && selectedUserIds.has(task.assignee_id));
  }, [selectedUserIds, tasks]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    filteredTasks.forEach((task) => {
      if (!task.due_date) return;
      const key = dateKey(task.due_date);
      map.set(key, [...(map.get(key) ?? []), task]);
    });
    return map;
  }, [filteredTasks]);

  const userToneById = useMemo(() => {
    return new Map(
      people.map((person, index) => [
        person.id,
        USER_EVENT_TONES[index % USER_EVENT_TONES.length],
      ]),
    );
  }, [people]);

  const filteredEvents = useMemo(() => {
    if (selectedUserIds.size === 0) return events;
    return events.filter((event) =>
      eventUserIds(event).some((id) => selectedUserIds.has(id)),
    );
  }, [events, selectedUserIds]);

  const eventUserTone = (event: CalendarEvent) => {
    const ids = eventUserIds(event);
    const selectedMatch = ids.find((id) => selectedUserIds.has(id));
    const id = selectedMatch ?? ids[0];
    return id ? userToneById.get(id) : null;
  };

  const eventVisualClass = (event: CalendarEvent, display: ReturnType<typeof eventDisplayState>) => {
    if (display.isComplete) return display.color;
    if (isMeetingRoomEvent(event)) return ROOM_BOOKING_COLOR;
    return eventUserTone(event)?.event ?? display.color;
  };

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
      const key = dateKey(event.starts_at);
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return map;
  }, [filteredEvents]);

  const selectedKey = dateKey(selected);
  const selectedTasks = tasksByDay.get(selectedKey) ?? [];
  const selectedEvents = eventsByDay.get(selectedKey) ?? [];
  const selectedIsToday = isSameDay(selected, today);
  const monthTitle = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
  }).format(cursor);
  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedUserId) ?? null,
    [people, selectedUserId],
  );

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
    setScheduleDefaults(null);
    setShowSchedule(true);
  };

  const openTaskDialog = () => {
    setQuickCreateOpen(false);
    setShowNewTask(true);
  };

  const deleteEvent = async (event: CalendarEvent) => {
    setEventMenu(null);
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

  const updateEventColor = async (event: CalendarEvent, color: string | null) => {
    setEventMenu(null);
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (res.status === 403) {
        toast.error(t("calendar.noPermission"));
        return;
      }
      if (!res.ok) throw new Error("Failed to update event");
      const updated = (await res.json()) as CalendarEvent;
      setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(color === COMPLETED_EVENT_COLOR ? t("calendar.eventCompleted") : t("calendar.eventUpdated"));
    } catch {
      toast.error(t("calendar.couldNotUpdate"));
    }
  };

  const openEventMenu = (event: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEventMenu({ event, x: e.clientX, y: e.clientY });
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
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setManageEvents(false)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-colors",
                    !manageEvents ? "bg-accent text-foreground dark:bg-white/10" : "text-muted-foreground hover:text-foreground",
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
                className="rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted dark:bg-white/5 dark:hover:bg-white/10"
              >
                {t("calendar.today")}
              </button>
              <button
                onClick={goPrev}
                aria-label={t("calendar.previousMonth")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:hover:bg-white/5"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goNext}
                aria-label={t("calendar.nextMonth")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:hover:bg-white/5"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-3 dark:border-white/10 dark:bg-white/[0.15]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {t("calendar.peopleFilter")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedPerson ? selectedPerson.name || selectedPerson.email : t("calendar.peopleFilterAll")}
                </p>
              </div>
              <label className="relative min-w-[220px]">
                <span className="sr-only">{t("calendar.peopleFilter")}</span>
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  disabled={peopleLoading}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 pr-9 text-xs font-medium text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-white/10 dark:bg-[#080d1b]"
                >
                  <option value="">
                    {peopleLoading ? t("common.loading") : t("calendar.allSchedules")}
                  </option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name || person.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!peopleLoading && people.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">{t("calendar.noUsersToFilter")}</p>
            )}
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
              const totalDayItems = dayEvents.length + dayTasks.length;
              const needsMoreIndicator = totalDayItems > DAY_CELL_VISIBLE_ITEM_LIMIT;
              const visibleItemSlots = needsMoreIndicator ? DAY_CELL_VISIBLE_ITEM_LIMIT - 1 : DAY_CELL_VISIBLE_ITEM_LIMIT;
              const visibleDayEvents = dayEvents.slice(0, visibleItemSlots);
              const visibleDayTasks = dayTasks.slice(0, Math.max(visibleItemSlots - visibleDayEvents.length, 0));
              const hiddenDayItems = totalDayItems - visibleDayEvents.length - visibleDayTasks.length;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(day)}
                  className={cn(
                    "flex h-24 min-h-24 flex-col items-start overflow-hidden rounded-lg border p-1 text-left transition-colors sm:h-32 sm:min-h-32 sm:p-1.5 xl:h-36 xl:min-h-36",
                    isSelected ? "border-primary/60 bg-primary/10" : "border-transparent hover:bg-accent dark:hover:bg-white/5",
                    !inMonth && "opacity-40",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium",
                      isToday
                        ? "w-5 h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 hidden w-full space-y-0.5 overflow-hidden sm:block" data-calendar-day-items>
                    {visibleDayEvents.map((event) => {
                      const display = eventDisplayState(event, today);
                      const isRoomBooking = isMeetingRoomEvent(event);

                      return (
                        <div
                          key={event.id}
                          title={`${eventTime(event)} ${event.title}${isRoomBooking ? ` - ${t("calendar.roomBooking")}` : ""}${display.isAutoComplete ? ` - ${t("calendar.autoCompleted")}` : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(day);
                            setEditingEvent(event);
                          }}
                          onContextMenu={(e) => openEventMenu(event, e)}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingEvent(event);
                          }}
                          className={cn("min-h-[15px] truncate rounded border-l-2 px-1 py-0.5 text-[9px] leading-none", eventVisualClass(event, display))}
                        >
                          {display.isComplete && <Check className="mr-0.5 inline h-2.5 w-2.5" />}
                          {isRoomBooking && !display.isComplete && <DoorOpen className="mr-0.5 inline h-2.5 w-2.5" />}
                          {eventTime(event)} {event.title}
                        </div>
                      );
                    })}
                    {visibleDayTasks.map((task) => (
                      <div
                        key={task.id}
                        title={task.title}
                        className={cn("min-h-[15px] truncate rounded border-l-2 px-1 py-0.5 text-[9px] leading-none", taskColor[task.priority])}
                      >
                        {task.title}
                      </div>
                    ))}
                    {hiddenDayItems > 0 && (
                      <div className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium leading-none text-muted-foreground dark:bg-white/5">
                        {t("calendar.more", { count: hiddenDayItems })}
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
                  <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl dark:border-white/10 dark:bg-[#070b18]/95 dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
                    <button
                      type="button"
                      onClick={() => openSchedule("meeting")}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-accent dark:hover:bg-white/10"
                    >
                      <Video className="h-3.5 w-3.5 text-upflow-success" />
                      {t("calendar.quickMeeting")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openSchedule("reminder")}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-accent dark:hover:bg-white/10"
                    >
                      <Bell className="h-3.5 w-3.5 text-primary" />
                      {t("calendar.quickEvent")}
                    </button>
                    <button
                      type="button"
                      onClick={openTaskDialog}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-accent dark:hover:bg-white/10"
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
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center dark:border-white/5 dark:bg-white/[0.15]">
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
                <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {selectedEvents.map((event) => {
                    const display = eventDisplayState(event, today);
                    const tone = eventUserTone(event);
                    const isRoomBooking = isMeetingRoomEvent(event);

                    return (
                      <li
                        key={event.id}
                        title={display.isAutoComplete ? t("calendar.autoCompleted") : undefined}
                        onClick={() => setEditingEvent(event)}
                        onContextMenu={(e) => openEventMenu(event, e)}
                        onDoubleClick={() => setEditingEvent(event)}
                        className={cn(
                          "group flex cursor-pointer items-center gap-2 rounded-lg border-l-2 px-3 py-2 transition-colors hover:bg-accent dark:hover:bg-white/5",
                          eventVisualClass(event, display),
                        )}
                      >
                        {isRoomBooking && !display.isComplete ? (
                          <DoorOpen className="h-3.5 w-3.5 shrink-0 text-cyan-100" />
                        ) : tone && !display.isComplete && (
                          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", tone.dot)} />
                        )}
                        <div
                          className={cn(
                            "min-w-0 flex-1 text-left",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                              {display.isComplete && <Check className="mr-1 inline h-3 w-3 text-upflow-success" />}
                              {eventTime(event)} {event.title}
                            </p>
                            {isRoomBooking && (
                              <span className="shrink-0 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-100">
                                {t("calendar.roomBooking")}
                              </span>
                            )}
                          </div>
                          {(event.location || event.meeting_url || event.description || display.isAutoComplete) && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {isRoomBooking
                                ? t("calendar.roomBookingDetail")
                                : event.location || event.meeting_url || event.description || t("calendar.autoCompleted")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void updateEventColor(event, COMPLETED_EVENT_COLOR);
                            }}
                            aria-label={`${t("calendar.markComplete")} ${event.title}`}
                            title={t("calendar.markComplete")}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-upflow-success hover:bg-upflow-success/10"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEvent(event);
                            }}
                            aria-label={`${t("calendar.editEvent")} ${event.title}`}
                            title={t("calendar.editEvent")}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:bg-white/10"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteEvent(event);
                            }}
                            aria-label={`${t("common.delete")} ${event.title}`}
                            title={t("common.delete")}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-upflow-danger hover:bg-upflow-danger/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-5 border-t border-border/60 pt-4 dark:border-white/5">
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
                        className={cn("block rounded-lg border-l-2 px-3 py-2 transition-colors hover:bg-accent dark:hover:bg-white/5", taskColor[task.priority])}
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
                <span className="w-3 h-3 rounded bg-cyan-400/40 border-l-2 border-l-cyan-400" />
                {t("calendar.legendRoomBooking")}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-upflow-success/40 border-l-2 border-l-upflow-success" />
                {t("calendar.legendCompletedEvent")}
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
        onClose={() => {
          setShowSchedule(false);
          setScheduleDefaults(null);
        }}
        initialDate={selected}
        initialTime={scheduleDefaults?.time ?? "09:00"}
        title={
          (scheduleDefaults?.type ?? scheduleType) === "meeting"
            ? t("calendar.quickMeeting")
            : t("calendar.quickEvent")
        }
        defaultType={scheduleDefaults?.type ?? scheduleType}
        defaultTitle={scheduleDefaults?.title}
        defaultDescription={scheduleDefaults?.description}
        defaultTaskId={scheduleDefaults?.taskId ?? null}
        defaultProjectId={scheduleDefaults?.projectId ?? null}
        defaultAttendeeIds={scheduleDefaults?.attendeeIds ?? []}
        onScheduled={(event) => {
          setEvents((prev) => [...prev, event].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()));
          setSelected(new Date(event.starts_at));
          setScheduleDefaults(null);
          loadCalendar({ silent: true });
        }}
      />

      <TaskCreateSheet
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        onCreated={() => {
          setShowNewTask(false);
          loadCalendar({ silent: true });
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

      {eventMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setEventMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setEventMenu(null);
          }}
        >
          <div
            className="absolute w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl dark:border-white/10 dark:bg-[#070b18]/95 dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
            style={{
              left: Math.min(eventMenu.x, window.innerWidth - 240),
              top: Math.min(eventMenu.y, window.innerHeight - 280),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setEditingEvent(eventMenu.event);
                setEventMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-accent dark:hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("calendar.editEvent")}
            </button>
            <button
              type="button"
              onClick={() => void updateEventColor(eventMenu.event, COMPLETED_EVENT_COLOR)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-upflow-success transition hover:bg-accent dark:hover:bg-white/10"
            >
              <Check className="h-3.5 w-3.5" />
              {t("calendar.markComplete")}
            </button>
            <div className="my-1 border-t border-border dark:border-white/10" />
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("calendar.changeColor")}
            </p>
            {EVENT_COLOR_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => void updateEventColor(eventMenu.event, option.color)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-accent dark:hover:bg-white/10"
              >
                <span className={cn("h-3 w-3 rounded border-l-2", option.className)} />
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
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
  const isRoomBooking = isMeetingRoomEvent(event);
  const roomLocation = event.location || ROOM_NAME;
  const [title, setTitle] = useState(event.title);
  const [time, setTime] = useState(toTimeInput(event.starts_at));
  const [location, setLocation] = useState(isRoomBooking ? roomLocation : event.location ?? "");
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
          location: isRoomBooking ? roomLocation : location.trim() || null,
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
              type: isRoomBooking
                ? t("calendar.roomBooking")
                : event.type === "meeting"
                  ? t("calendar.meeting")
                  : t("calendar.event"),
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
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{t("calendar.fieldTime")}</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{t("calendar.fieldLocation")}</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={isRoomBooking}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
            />
            {isRoomBooking && (
              <p className="mt-1 text-[11px] text-muted-foreground">{t("calendar.roomBookingLocked")}</p>
            )}
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
            className="flex-1 rounded-lg border border-border py-2 text-sm text-foreground hover:bg-accent disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/10"
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
