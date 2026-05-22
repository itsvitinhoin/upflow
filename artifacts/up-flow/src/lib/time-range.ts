export function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function secondsBetween(startedAt: Date, stoppedAt: Date): number {
  return Math.max(0, Math.round((stoppedAt.getTime() - startedAt.getTime()) / 1000));
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function startOfWeekMonday(): Date {
  const today = startOfToday();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setDate(today.getDate() + diff);
  return start;
}
