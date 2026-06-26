"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Folder, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

interface ProjectRowProps {
  project: Project;
  onMove: () => void;
  onNavigate?: () => void;
  isActive: boolean;
  canManageWorkspace: boolean;
}

export function ProjectRow({
  project,
  onMove,
  onNavigate,
  isActive,
  canManageWorkspace,
}: ProjectRowProps) {
  const { t } = useLanguage();
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-xl border border-transparent px-1 py-0.5 transition-all hover:border-blue-300/10 hover:bg-white/[0.045]",
        isActive &&
          "border-blue-300/20 bg-blue-500/12 shadow-[0_0_18px_rgba(59,130,246,0.14)]"
      )}
    >
      <Link
        href={`/projects/${project.id}`}
        onClick={onNavigate}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-xs truncate outline-none transition-colors",
          isActive
            ? "text-foreground font-medium"
            : "text-foreground/85 hover:text-foreground focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary/60"
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 flex-shrink-0 rounded-full",
            isActive
              ? "bg-blue-300 shadow-[0_0_10px_rgba(96,165,250,0.85)]"
              : "bg-slate-500/80",
          )}
        />
        <span className="truncate">{project.name}</span>
      </Link>
      {canManageWorkspace && (
      <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={`Actions for ${project.name}`}
          aria-expanded={open}
          data-menu-trigger
          className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <MoreHorizontal className="w-3 h-3" />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-xl border border-blue-300/10 bg-[#080d1d]/95 text-xs shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMove();
              }}
              className="w-full flex items-center gap-2 text-left px-3 py-2 hover:bg-white/5"
            >
              <Folder className="w-3 h-3" /> Move to space...
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                toast.error(t("projects.workspaceDeleteBlocked"));
              }}
              className="w-full flex items-center gap-2 text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 border-t border-white/5"
            >
              <Trash2 className="w-3 h-3" /> {t("common.delete")}
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
