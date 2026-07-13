"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, DoorOpen, Users, X, Video } from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import { APP_TIME_ZONE, mergeAppDateAndTime } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { useAppUser } from "@/components/user-provider";

const COLORS = [
  "bg-primary/20 text-primary",
  "bg-upflow-success/20 text-upflow-success",
  "bg-upflow-warning/20 text-upflow-warning",
  "bg-upflow-danger/20 text-upflow-danger",
];

type SelectableUser = {
  id: string;
  name: string | null;
  email: string;
};

function buildStartsAt(time: string, date?: Date) {
  return mergeAppDateAndTime(date ?? new Date(), time);
}

function dateInputValue(date?: Date) {
  const copy = new Date(date ?? new Date());
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function dateFromInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

export default function ScheduleMeetingDialog({
  open,
  onClose,
  onScheduled,
  initialDate,
  initialTime = "09:00",
  title: dialogTitle,
  defaultTitle,
  defaultDescription,
  defaultAttendeeIds = [],
  defaultTaskId,
  defaultProjectId,
  defaultLocation,
  defaultType = "meeting",
  roomBooking = false,
}: {
  open: boolean;
  onClose: () => void;
  onScheduled?: (meeting: CalendarEvent) => void;
  initialDate?: Date;
  initialTime?: string;
  title?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultAttendeeIds?: string[];
  defaultTaskId?: string | null;
  defaultProjectId?: string | null;
  defaultLocation?: string | null;
  defaultType?: "meeting" | "reminder";
  roomBooking?: boolean;
}) {
  const { t } = useLanguage();
  const user = useAppUser();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(dateInputValue(initialDate));
  const [time, setTime] = useState(initialTime);
  const [withWho, setWithWho] = useState("");
  const [eventType, setEventType] = useState<"meeting" | "reminder">(defaultType);
  const [colorIdx, setColorIdx] = useState(0);
  const [attendeeOptions, setAttendeeOptions] = useState<SelectableUser[]>([]);
  const [attendees, setAttendees] = useState<SelectableUser[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState("");
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(dateInputValue(initialDate));
    setTime(initialTime);
    setEventType(roomBooking ? "meeting" : defaultType);
    setTitle(defaultTitle ?? "");
    setWithWho(defaultDescription ?? "");
  }, [defaultDescription, defaultTitle, defaultType, initialDate, initialTime, open, roomBooking]);

  useEffect(() => {
    if (!open) return;
    setAttendees([]);
    setSelectedAttendeeId("");
  }, [open]);

  useEffect(() => {
    if (!open || defaultAttendeeIds.length === 0 || attendeeOptions.length === 0) return;
    const selectedIds = new Set(defaultAttendeeIds);
    setAttendees(attendeeOptions.filter((person) => selectedIds.has(person.id) && person.id !== user?.id));
  }, [attendeeOptions, defaultAttendeeIds, open, user?.id]);

  useEffect(() => {
    if (!open || !user?.currentWorkspaceId) return;
    const controller = new AbortController();
    setAttendeesLoading(true);
    fetch(`/api/users?workspace_id=${user.currentWorkspaceId}&status=active`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return { items: [] };
        return (await res.json()) as { items?: SelectableUser[] };
      })
      .then((data) => setAttendeeOptions(data.items ?? []))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setAttendeeOptions([]);
      })
      .finally(() => setAttendeesLoading(false));

    return () => controller.abort();
  }, [open, user?.currentWorkspaceId]);

  if (!open) return null;

  const availableAttendees = attendeeOptions.filter(
    (person) =>
      person.id !== user?.id && !attendees.some((item) => item.id === person.id),
  );

  const addAttendee = () => {
    const person = attendeeOptions.find((item) => item.id === selectedAttendeeId);
    if (!person) return;
    setAttendees((prev) => [...prev, person]);
    setSelectedAttendeeId("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !time) {
      toast.error(t("calendar.titleAndTimeRequired"));
      return;
    }

    const startsAt = buildStartsAt(time, dateFromInput(date));
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const attendeeIds = attendees.map((attendee) => attendee.id);
    const resolvedType = roomBooking ? "meeting" : eventType;
    const resolvedLocation = roomBooking ? defaultLocation || "Sala de Reuniao" : defaultLocation;
    setSubmitting(true);
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: withWho.trim() ? withWho.trim() : null,
          type: resolvedType,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          timezone: APP_TIME_ZONE,
          color: roomBooking ? "bg-cyan-400/20 text-cyan-100 border-l-cyan-400" : COLORS[colorIdx],
          ...(resolvedLocation ? { location: resolvedLocation } : {}),
          ...(defaultProjectId ? { project_id: defaultProjectId } : {}),
          ...(defaultTaskId ? { task_id: defaultTaskId } : {}),
          ...(attendeeIds.length ? { attendee_ids: attendeeIds } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed to schedule meeting");
      const meeting = (await res.json()) as CalendarEvent;
      toast.success(
        roomBooking
          ? t("meetingRoom.roomReserved")
          : eventType === "meeting"
          ? t("calendar.meetingScheduled")
          : t("calendar.eventScheduled"),
      );
      onScheduled?.(meeting);
      setTitle(defaultTitle ?? "");
      setDate(dateInputValue(initialDate));
      setWithWho(defaultDescription ?? "");
      setAttendees([]);
      setSelectedAttendeeId("");
      onClose();
    } catch {
      toast.error(t("calendar.couldNotSchedule"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-upflow-success/20 text-upflow-success flex items-center justify-center">
              {roomBooking ? (
                <DoorOpen className="w-4 h-4" />
              ) : eventType === "meeting" ? (
                <Video className="w-4 h-4" />
              ) : (
                <CalendarPlus className="w-4 h-4" />
              )}
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {dialogTitle ?? t("calendar.scheduleMeeting")}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">{t("calendar.fieldTitle")}</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("calendar.titlePlaceholder")}
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
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
            <label className="block text-xs font-medium text-foreground mb-1.5">{t("calendar.with")}</label>
            <input
              value={withWho}
              onChange={(e) => setWithWho(e.target.value)}
              placeholder={
                roomBooking
                  ? t("meetingRoom.bookingDetailsPlaceholder")
                  : eventType === "meeting"
                  ? t("calendar.withPlaceholder")
                  : t("calendar.eventDetailsPlaceholder")
              }
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-foreground">
            {t("calendar.attendees")}
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Users className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
              <select
                value={selectedAttendeeId}
                onChange={(e) => setSelectedAttendeeId(e.target.value)}
                disabled={attendeesLoading || availableAttendees.length === 0}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">
                  {attendeesLoading ? t("common.loading") : t("calendar.chooseAttendee")}
                </option>
                {availableAttendees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name || person.email}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={addAttendee}
              disabled={!selectedAttendeeId}
              className="h-10 rounded-lg border border-white/10 px-3 text-xs font-semibold text-foreground transition hover:bg-white/10 disabled:opacity-40"
            >
              {t("calendar.addAttendee")}
            </button>
          </div>
          {attendees.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {attendees.map((person) => (
                <span
                  key={person.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                >
                  <span className="min-w-0 truncate">{person.name || person.email}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttendees((prev) =>
                        prev.filter((attendee) => attendee.id !== person.id),
                      )
                    }
                    aria-label={`${t("common.delete")} ${person.name || person.email}`}
                    className="shrink-0 rounded-full hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("calendar.noAttendees")}
            </p>
          )}
        </div>
        {roomBooking ? (
          <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2">
            <p className="text-xs font-semibold text-cyan-100">{t("meetingRoom.bookingType")}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{defaultLocation || "Sala de Reuniao"}</p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setEventType("meeting")}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  eventType === "meeting"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                }`}
              >
                {t("calendar.meeting")}
              </button>
              <button
                type="button"
                onClick={() => setEventType("reminder")}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  eventType === "reminder"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                }`}
              >
                {t("calendar.event")}
              </button>
            </div>
            <label className="block text-xs font-medium text-foreground mt-4 mb-1.5">{t("calendar.tag")}</label>
            <div className="flex gap-2">
              {COLORS.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorIdx(i)}
                  aria-label={`Color ${i + 1}`}
                  className={`w-8 h-8 rounded-lg ${c} ${
                    colorIdx === i ? "ring-2 ring-foreground/40" : ""
                  }`}
                />
              ))}
            </div>
          </>
        )}
        <div className="flex gap-2 mt-6">
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
            {submitting
              ? t("calendar.scheduling")
              : roomBooking
                ? t("meetingRoom.reserveRoom")
                : t("calendar.schedule")}
          </button>
        </div>
      </form>
    </div>
  );
}
