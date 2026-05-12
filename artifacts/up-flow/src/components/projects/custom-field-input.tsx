"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { CustomFieldDefinition, TaskAssignee } from "@/lib/types";

interface Props {
  definition: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  users?: TaskAssignee[];
  compact?: boolean;
}

const inputCls =
  "w-full text-sm bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export default function CustomFieldInput({
  definition,
  value,
  onChange,
  users = [],
  compact = false,
}: Props) {
  if (definition.type === "text") {
    return (
      <input
        type="text"
        defaultValue={(value as string) ?? ""}
        onBlur={(e) => onChange(e.target.value || null)}
        placeholder="—"
        className={inputCls}
      />
    );
  }
  if (definition.type === "number") {
    return (
      <input
        type="number"
        defaultValue={value === null || value === undefined ? "" : String(value)}
        onBlur={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="—"
        className={inputCls}
      />
    );
  }
  if (definition.type === "date") {
    const dateVal = typeof value === "string" ? value.slice(0, 10) : "";
    return (
      <input
        type="date"
        defaultValue={dateVal}
        onBlur={(e) => onChange(e.target.value || null)}
        className={inputCls}
      />
    );
  }
  if (definition.type === "checkbox") {
    const checked = !!value;
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
          checked ? "bg-primary border-primary" : "border-border hover:border-primary",
        )}
      >
        {checked && <Check className="w-3 h-3 text-primary-foreground" />}
      </button>
    );
  }
  if (definition.type === "dropdown") {
    const options = definition.options ?? [];
    return (
      <div className="relative">
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={cn(inputCls, "appearance-none pr-8")}
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>
    );
  }
  if (definition.type === "people") {
    return (
      <PeoplePicker
        selected={Array.isArray(value) ? (value as string[]) : []}
        users={users}
        onChange={(ids) => onChange(ids.length === 0 ? null : ids)}
        compact={compact}
      />
    );
  }
  return null;
}

function PeoplePicker({
  selected,
  users,
  onChange,
  compact,
}: {
  selected: string[];
  users: TaskAssignee[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(selected);

  useEffect(() => {
    setLocal(selected);
  }, [selected.join(",")]);

  const selectedUsers = users.filter((u) => local.includes(u.id));

  const toggle = (id: string) => {
    const next = local.includes(id) ? local.filter((x) => x !== id) : [...local, id];
    setLocal(next);
    onChange(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-1.5 text-left bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-white/10",
          compact && "py-1",
        )}
      >
        {selectedUsers.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex -space-x-1">
            {selectedUsers.slice(0, 3).map((u) => (
              <div
                key={u.id}
                title={u.name}
                className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center ring-1 ring-card"
              >
                {getInitials(u.name)}
              </div>
            ))}
            {selectedUsers.length > 3 && (
              <span className="text-xs text-muted-foreground ml-2">
                +{selectedUsers.length - 3}
              </span>
            )}
          </div>
        )}
        <ChevronDown className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 left-0 min-w-[220px] bg-popover border border-border rounded-lg shadow-xl p-1 max-h-64 overflow-y-auto">
            {users.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No teammates</div>
            )}
            {users.map((u) => {
              const on = local.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggle(u.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-foreground hover:bg-muted"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                    {getInitials(u.name)}
                  </div>
                  <span className="flex-1 text-left truncate">{u.name}</span>
                  {on && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              );
            })}
            {local.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setLocal([]);
                  onChange([]);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted border-t border-border mt-1"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
