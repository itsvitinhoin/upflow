"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, Video } from "lucide-react";
import type { Meeting } from "@/lib/dashboard-mocks";

export const MEETINGS_KEY = "upflow.meetings.today";

const COLORS = [
  "bg-primary/20 text-primary",
  "bg-upflow-success/20 text-upflow-success",
  "bg-upflow-warning/20 text-upflow-warning",
  "bg-upflow-danger/20 text-upflow-danger",
];

export function loadStoredMeetings(): Meeting[] {
  try {
    const raw = localStorage.getItem(MEETINGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Meeting[];
  } catch {
    return [];
  }
}

export default function ScheduleMeetingDialog({
  open,
  onClose,
  onScheduled,
}: {
  open: boolean;
  onClose: () => void;
  onScheduled: (meeting: Meeting) => void;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [withWho, setWithWho] = useState("");
  const [colorIdx, setColorIdx] = useState(0);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !time) {
      toast.error("Title and time are required");
      return;
    }
    const meeting: Meeting = {
      time,
      title: title.trim(),
      with: withWho.trim() || "Team",
      color: COLORS[colorIdx],
    };
    try {
      const existing = loadStoredMeetings();
      const next = [...existing, meeting].sort((a, b) => a.time.localeCompare(b.time));
      localStorage.setItem(MEETINGS_KEY, JSON.stringify(next));
    } catch (err) {
      // localStorage can throw on quota-exceeded or in privacy modes; the
      // meeting is still surfaced via the toast + onScheduled callback for
      // the current session.
      console.warn("[upflow] schedule-meeting-dialog: localStorage write failed", err);
    }
    toast.success("Meeting scheduled");
    onScheduled(meeting);
    setTitle("");
    setWithWho("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="glass-strong rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-upflow-success/20 text-upflow-success flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Schedule meeting</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Sprint review"
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">With</label>
            <input
              value={withWho}
              onChange={(e) => setWithWho(e.target.value)}
              placeholder="Team / client"
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <label className="block text-xs font-medium text-foreground mt-4 mb-1.5">Tag</label>
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
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            Schedule
          </button>
        </div>
      </form>
    </div>
  );
}
