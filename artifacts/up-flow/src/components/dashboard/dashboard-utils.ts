import type { ActivityEvent, Task, TimeEntry } from "@/lib/types";

export type DashboardRecent = {
  who: string;
  what: string;
  target: string;
  status: "completed" | "in_progress";
  when: string;
  dayIndex: number;
};

export function greetingTime() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function formatSecondsShort(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function taskStatusLabel(
  status: Task["status"],
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (status === "todo") return t("status.todo");
  if (status === "in_progress") return t("status.inProgress");
  return t("status.done");
}

export function priorityLabel(
  priority: Task["priority"],
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (priority === "high") return t("priority.high");
  if (priority === "medium") return t("priority.medium");
  return t("priority.low");
}

export function moneyCompact(value: number | null | undefined) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

export function entrySeconds(entry: TimeEntry) {
  if (entry.status === "running") {
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(entry.started_at).getTime()) / 1000),
    );
  }
  return entry.duration_seconds;
}

export function sameLocalDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dashboardDayIndex(value: string | Date) {
  const date = new Date(value);
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

export function dashboardWhen(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

export function dashboardActivityText(event: ActivityEvent) {
  const rawName = event.metadata?.title ?? event.metadata?.name ?? event.entity_type;
  const target = typeof rawName === "string" ? rawName : event.entity_type;
  const what = event.type
    .replace(/_/g, " ")
    .replace("task status changed", "changed")
    .replace("calendar event", "event")
    .replace("time entry", "timer");
  return { what, target };
}

export function dashboardActivityStatus(event: ActivityEvent): "completed" | "in_progress" {
  return event.type.includes("deleted") || event.type.includes("stopped") || event.type.includes("done")
    ? "completed"
    : "in_progress";
}

export function buildDashboardWeekActivity(
  activity: ActivityEvent[],
  timeEntries: TimeEntry[],
) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return labels.map((day, index) => {
    const actions = activity.filter((event) => dashboardDayIndex(event.created_at) === index).length;
    const trackedSeconds = timeEntries
      .filter((entry) => dashboardDayIndex(entry.started_at) === index)
      .reduce((sum, entry) => sum + entrySeconds(entry), 0);
    const dots = Math.min(5, Math.max(actions, trackedSeconds > 0 ? 1 : 0));
    return {
      day,
      hours: Math.round((trackedSeconds / 3600) * 10) / 10,
      tasks: actions,
      items: Array.from({ length: dots }, (_, dotIndex) => ({
        size: Math.min(18, 8 + dotIndex * 2 + actions),
        color:
          dotIndex % 3 === 0
            ? "bg-primary"
            : dotIndex % 3 === 1
              ? "bg-upflow-success"
              : "bg-upflow-warning",
      })),
    };
  });
}

export function buildDashboardRecent(activity: ActivityEvent[]): DashboardRecent[] {
  return activity.map((event) => {
    const label = dashboardActivityText(event);
    return {
      who: event.actor?.name ?? "Someone",
      what: label.what,
      target: label.target,
      status: dashboardActivityStatus(event),
      when: dashboardWhen(event.created_at),
      dayIndex: dashboardDayIndex(event.created_at),
    };
  });
}
