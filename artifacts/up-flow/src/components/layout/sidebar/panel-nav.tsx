"use client";

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
}

export function PanelNav({ pathname, onNavigate, onCreateSpace, onCollapseAll }: PanelNavProps) {
  const { t } = useLanguage();
  return (
    <>
      <div className="px-4 pt-4 pb-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
              className={cn(
                "relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/60",
                active
                  ? "bg-gradient-to-r from-blue-500/18 to-violet-500/10 text-foreground shadow-[0_0_22px_rgba(59,130,246,0.14)]"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground hover:shadow-[0_0_18px_rgba(139,92,246,0.08)]",
              )}
            >
              {active && (
                <span className="absolute left-0 h-5 w-0.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
              )}
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-3 border-t border-white/5" />
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("sidebar.workspace")}
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            {t("sidebar.spaces")}
          </h3>
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
          <button
            type="button"
            onClick={onCreateSpace}
            aria-label={t("sidebar.newSpace")}
            title={t("sidebar.newSpace")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground hover:shadow-[0_0_16px_rgba(59,130,246,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
