import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isBefore, parseISO } from "date-fns";

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

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d, yyyy");
}

export function isOverdue(dueDate: string | Date | null | undefined): boolean {
  if (!dueDate) return false;
  const d = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
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
