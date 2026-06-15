"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Video } from "lucide-react";
import type { CalendarEvent } from "@/lib/types";
import { APP_TIME_ZONE, formatLongDate, mergeAppDateAndTime } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

const COLORS = [
  "bg-primary/20 text-primary",
  "bg-upflow-success/20 text-upflow-success",
  "bg-upflow-warning/20 text-upflow-warning",
  "bg-upflow-danger/20 text-upflow-danger",
];

function buildStartsAt(time: string, date?: Date) {
  return mergeAppDateAndTime(date ?? new Date(), time);
}

export default function ScheduleMeetingDialog({
  open,
  onClose,
  onScheduled,
  initialDate,
  initialTime = "09:00",
  title: dialogTitle,
  defaultProjectId,
}: {
  open: boolean;
  onClose: () => void;
  onScheduled?: (meeting: CalendarEvent) => void;
  initialDate?: Date;
  initialTime?: string;
  title?: string;
  defaultProjectId?: string | null;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(initialTime);
  const [withWho, setWithWho] = useState("");
  const [colorIdx, setColorIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTime(initialTime);
  }, [initialTime, open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !time) {
      toast.error(t("calendar.titleAndTimeRequired"));
      return;
    }

    const startsAt = buildStartsAt(time, initialDate);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    setSubmitting(true);
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: withWho.trim() ? `With ${withWho.trim()}` : null,
          type: "meeting",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          timezone: APP_TIME_ZONE,
          color: COLORS[colorIdx],
          ...(defaultProjectId ? { project_id: defaultProjectId } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed to schedule meeting");
      const meeting = (await res.json()) as CalendarEvent;
      toast.success(t("calendar.meetingScheduled"));
      onScheduled?.(meeting);
      setTitle("");
      setWithWho("");
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
              <Video className="w-4 h-4" />
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
        {initialDate && (
          <p className="mt-2 text-xs text-muted-foreground">
            {formatLongDate(initialDate)}
          </p>
        )}
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
            <label className="block text-xs font-medium text-foreground mb-1.5">{t("calendar.with")}</label>
            <input
              value={withWho}
              onChange={(e) => setWithWho(e.target.value)}
              placeholder={t("calendar.withPlaceholder")}
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
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
            {submitting ? t("calendar.scheduling") : t("calendar.schedule")}
          </button>
        </div>
      </form>
    </div>
  );
}
