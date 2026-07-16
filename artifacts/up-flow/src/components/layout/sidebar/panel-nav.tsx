"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronsUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { primaryNav } from "@/components/layout/sidebar/rail";

interface PanelNavProps {
  pathname: string;
  onNavigate?: () => void;
  onCreateSpace: () => void;
  onCollapseAll: () => void;
  canManageWorkspace: boolean;
  pinnedContent?: ReactNode;
}

export function PanelNav({
  pathname,
  onNavigate,
  onCreateSpace,
  onCollapseAll,
  canManageWorkspace,
  pinnedContent,
}: PanelNavProps) {
  const { t } = useLanguage();
  return (
    <>
      <div className="px-4 pb-1 pt-4">
        <p className="text-[9px] uppercase tracking-[0.2em] text-blue-200/45">
          {t("sidebar.navigation")}
        </p>
      </div>
      <nav className="px-2 pb-2 space-y-0.5">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey) || item.label;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/60",
                active
                  ? "bg-gradient-to-r from-blue-600/55 to-violet-600/32 text-white shadow-[0_0_30px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-blue-300/20"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground hover:shadow-[0_0_22px_rgba(139,92,246,0.12)]",
              )}
            >
              {active && (
                <>
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(96,165,250,0.24),transparent_42%)]" />
                  <span className="absolute left-0 h-6 w-0.5 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(59,130,246,0.9)]" />
                </>
              )}
              <Icon
                className={cn(
                  "relative h-3.5 w-3.5",
                  active && "drop-shadow-[0_0_8px_rgba(147,197,253,0.8)]",
                )}
              />
              <span className="relative truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
      {pinnedContent ? <div className="px-2 pb-2">{pinnedContent}</div> : null}
      <div className="mx-3 border-t border-blue-300/10" />
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-blue-200/45">
            {t("sidebar.spaces")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCollapseAll}
            aria-label={t("sidebar.collapseAll")}
            title={t("sidebar.collapseAll")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground hover:shadow-[0_0_16px_rgba(59,130,246,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <ChevronsUp className="w-4 h-4" />
          </button>
          {canManageWorkspace && (
            <button
              type="button"
              onClick={onCreateSpace}
              aria-label={t("sidebar.newSpace")}
              title={t("sidebar.newSpace")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground hover:shadow-[0_0_16px_rgba(59,130,246,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
