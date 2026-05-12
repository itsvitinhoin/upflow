"use client";

import { Check, X } from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { CustomFieldDefinition, TaskAssignee } from "@/lib/types";

interface Props {
  definition: CustomFieldDefinition;
  value: unknown;
  users?: TaskAssignee[];
}

export default function CustomFieldChip({ definition, value, users = [] }: Props) {
  if (value === null || value === undefined || value === "") {
    if (definition.type !== "checkbox") return null;
  }

  if (definition.type === "checkbox") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground"
        title={definition.name}
      >
        {value ? (
          <Check className="w-3 h-3 text-upflow-success" />
        ) : (
          <X className="w-3 h-3" />
        )}
        {definition.name}
      </span>
    );
  }

  let display: string | null = null;
  if (definition.type === "date" && typeof value === "string") {
    display = formatDate(value);
  } else if (definition.type === "people" && Array.isArray(value)) {
    const ids = value as string[];
    const selected = users.filter((u) => ids.includes(u.id));
    if (selected.length === 0) return null;
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-muted"
        title={`${definition.name}: ${selected.map((u) => u.name).join(", ")}`}
      >
        <span className="text-muted-foreground">{definition.name}</span>
        <span className="flex -space-x-1">
          {selected.slice(0, 2).map((u) => (
            <span
              key={u.id}
              className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center ring-1 ring-card"
            >
              {getInitials(u.name)}
            </span>
          ))}
          {selected.length > 2 && (
            <span className="text-[10px] text-muted-foreground ml-1.5">
              +{selected.length - 2}
            </span>
          )}
        </span>
      </span>
    );
  } else if (definition.type === "number") {
    display = String(value);
  } else if (definition.type === "dropdown" || definition.type === "text") {
    display = String(value);
  }

  if (!display) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground max-w-[140px] truncate",
      )}
      title={`${definition.name}: ${display}`}
    >
      <span className="text-foreground/80 font-medium">{definition.name}:</span>
      <span className="truncate">{display}</span>
    </span>
  );
}
