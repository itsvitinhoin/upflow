"use client";

import { useMemo, useState } from "react";
import { Bell, Search, UserCheck, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskAssignee } from "@/lib/types";

interface TaskAssigneePickerProps {
  value: string;
  users: TaskAssignee[];
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  emptyLabel?: string;
  mode?: "create" | "update";
  className?: string;
  selectClassName?: string;
}

export default function TaskAssigneePicker({
  value,
  users,
  onChange,
  disabled = false,
  label = "Assignee",
  emptyLabel = "Unassigned",
  mode = "create",
  className,
  selectClassName,
}: TaskAssigneePickerProps) {
  const [query, setQuery] = useState("");
  const selected = users.find((user) => user.id === value) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleUsers = useMemo(() => {
    if (!normalizedQuery) return users;
    return users.filter((user) => {
      const haystack = `${user.name} ${user.email}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, users]);
  const usersForSelect =
    selected && !visibleUsers.some((user) => user.id === selected.id)
      ? [selected, ...visibleUsers]
      : visibleUsers;

  const notifyText = selected
    ? mode === "create"
      ? `${selected.name} will be notified when this task is created.`
      : `${selected.name} will be notified about this assignment.`
    : "No one will be notified until this task is assigned.";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {selected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Bell className="h-3 w-3" />
            Notify
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <UserMinus className="h-3 w-3" />
            No owner
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled || users.length === 0}
          placeholder="Search active workspace members"
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      </div>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || users.length === 0}
        className={cn(
          "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60",
          selectClassName,
        )}
      >
        <option value="">{emptyLabel}</option>
        {usersForSelect.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} - {user.email}
          </option>
        ))}
      </select>

      {users.length === 0 ? (
        <p className="text-xs text-upflow-warning">
          No active members are available for this list yet.
        </p>
      ) : normalizedQuery && visibleUsers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No active member matches &quot;{query.trim()}&quot;.
        </p>
      ) : (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <UserCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{notifyText}</span>
        </p>
      )}
    </div>
  );
}
