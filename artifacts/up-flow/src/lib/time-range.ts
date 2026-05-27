export function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function secondsBetween(startedAt: Date, stoppedAt: Date): number {
  return Math.max(0, Math.round((stoppedAt.getTime() - startedAt.getTime()) / 1000));
}

export const DEFAULT_APP_TIME_ZONE =
  process.env.APP_TIMEZONE || "America/Sao_Paulo";

function zonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = zonedDateParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return localAsUtc - date.getTime();
}

export function zonedStartOfDay(
  date = new Date(),
  timeZone = DEFAULT_APP_TIME_ZONE,
): Date {
  const parts = zonedDateParts(date, timeZone);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day);
  const offset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
}

export function startOfToday(now = new Date()): Date {
  return zonedStartOfDay(now);
}

export function startOfWeekMonday(now = new Date()): Date {
  const timeZone = DEFAULT_APP_TIME_ZONE;
  const parts = zonedDateParts(now, timeZone);
  const localNoon = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12));
  const day = localNoon.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mondayUtcGuess = Date.UTC(parts.year, parts.month - 1, parts.day + diff);
  const offset = timeZoneOffsetMs(new Date(mondayUtcGuess), timeZone);
  return new Date(mondayUtcGuess - offset);
}
