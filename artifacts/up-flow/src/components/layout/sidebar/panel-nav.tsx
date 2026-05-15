"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { primaryNav } from "@/components/layout/sidebar/rail";

interface PanelNavProps {
  pathname: string;
  onNavigate?: () => void;
  onCreateSpace: () => void;
}

export function PanelNav({ pathname, onNavigate, onCreateSpace }: PanelNavProps) {
  return (
    <>
      <div className="px-4 pt-4 pb-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Navigation
        </p>
      </div>
      <nav className="px-2 pb-2 space-y-0.5">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                active
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-3 border-t border-white/5" />
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          <h3 className="text-sm font-semibold text-foreground">Spaces</h3>
        </div>
        <button
          onClick={onCreateSpace}
          aria-label="New space"
          title="New space"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
