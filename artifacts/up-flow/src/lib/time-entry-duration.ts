export type TimeEntryDurationInput = {
  status: "running" | "paused" | "stopped";
  started_at: string | Date;
  active_started_at?: string | Date | null;
  duration_seconds: number;
};

/**
 * Returns active work time only. Paused intervals are excluded because each
 * completed running segment is folded into duration_seconds by the API.
 */
export function timeEntryDurationSeconds(
  entry: TimeEntryDurationInput,
  now = new Date(),
) {
  const accumulated = Number.isFinite(entry.duration_seconds)
    ? Math.max(0, entry.duration_seconds)
    : 0;

  if (entry.status !== "running") return accumulated;

  const activeStartedAt = new Date(
    entry.active_started_at ?? entry.started_at,
  ).getTime();
  if (Number.isNaN(activeStartedAt)) return accumulated;

  return accumulated + Math.max(0, Math.round((now.getTime() - activeStartedAt) / 1000));
}
