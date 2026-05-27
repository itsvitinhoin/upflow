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
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
                active
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
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
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <ChevronsUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onCreateSpace}
            aria-label={t("sidebar.newSpace")}
            title={t("sidebar.newSpace")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
