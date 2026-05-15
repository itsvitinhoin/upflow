"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Folder, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { logError } from "@/lib/log-error";

interface ProjectRowProps {
  project: Project;
  onMove: () => void;
  onNavigate?: () => void;
  onDeleted: () => void;
  isActive: boolean;
}

export function ProjectRow({
  project,
  onMove,
  onNavigate,
  onDeleted,
  isActive,
}: ProjectRowProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && target.closest('[role="menu"], [data-menu-trigger]')) return;
      setOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", h);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", h);
    };
  }, [open]);

  const handleDelete = async () => {
    setOpen(false);
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Project deleted");
        onDeleted();
      } else {
        toast.error("Could not delete project");
      }
    } catch (err) {
      logError("sidebar:project-row:delete", err, { id: project.id });
      toast.error("Could not delete project");
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 transition-colors",
        isActive && "bg-primary/15"
      )}
    >
      <Link
        href={`/projects/${project.id}`}
        onClick={onNavigate}
        className={cn(
          "flex-1 min-w-0 text-xs truncate",
          isActive ? "text-foreground font-medium" : "text-foreground/85 hover:text-foreground"
        )}
      >
        {project.name}
      </Link>
      <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={`Actions for ${project.name}`}
          data-menu-trigger
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <MoreHorizontal className="w-3 h-3" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-40 glass-strong rounded-lg z-30 overflow-hidden text-xs"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMove();
              }}
              className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5"
            >
              <Folder className="w-3 h-3" /> Move to space…
            </button>
            <button
              role="menuitem"
              onClick={handleDelete}
              className="w-full flex items-center gap-2 text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 border-t border-white/5"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
