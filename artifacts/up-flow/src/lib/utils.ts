import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { isBefore, parseISO } from "date-fns";

export const APP_LOCALE = "pt-BR";
export const APP_TIME_ZONE = "America/Sao_Paulo";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function normalizeDate(date: string | Date): Date {
  return typeof date === "string" ? parseISO(date) : date;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(normalizeDate(date));
}

export function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(normalizeDate(date));
}

export function formatLongDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(normalizeDate(date));
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).format(normalizeDate(date));
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).format(normalizeDate(date));
}

export function formatIsoDateInput(date: string | Date | null | undefined): string {
  if (!date) return "";
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const d = normalizeDate(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}/${month}/${year}`;
}

export function maskBrazilianDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseBrazilianDateInput(value: string): string | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "invalid";

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "invalid";
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isOverdue(dueDate: string | Date | null | undefined): boolean {
  if (!dueDate) return false;
  const d = normalizeDate(dueDate);
  return isBefore(d, new Date());
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "bg-upflow-danger/15 text-upflow-danger";
    case "medium":
      return "bg-upflow-warning/15 text-upflow-warning";
    case "low":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "done":
    case "active":
      return "bg-upflow-success/15 text-upflow-success";
    case "in_progress":
      return "bg-primary/15 text-primary";
    case "todo":
    case "archived":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "done":
      return "Done";
    case "active":
      return "Active";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}
