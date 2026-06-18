"use client";

import Link from "next/link";
import Image from "next/image";
import {
  LayoutGrid,
  Users,
  Clock,
  Inbox,
  Calendar,
  Kanban,
  Building2,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import type { AppUser } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  labelKey: string;
  icon: LucideIcon;
}

export const primaryNav: NavItem[] = [
  { href: "/", label: "Dashboard", labelKey: "nav.dashboard", icon: LayoutGrid },
  { href: "/team", label: "Team", labelKey: "nav.team", icon: Users },
  { href: "/time", label: "Time tracking", labelKey: "nav.timeTracking", icon: Clock },
  { href: "/inbox", label: "Inbox", labelKey: "nav.inbox", icon: Inbox },
  { href: "/calendar", label: "Calendar", labelKey: "nav.calendar", icon: Calendar },
  { href: "/projects", label: "Projects", labelKey: "nav.projects", icon: Kanban },
  { href: "/clients", label: "Clients", labelKey: "nav.clients", icon: Building2 },
];

interface RailProps {
  user: AppUser;
  pathname: string | null;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onSignOut: () => void;
  onNavigate?: () => void;
}

function isActiveHref(pathname: string | null, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || (pathname?.startsWith(href + "/") ?? false);
}

export function Rail({
  user,
  pathname,
  panelOpen,
  onTogglePanel,
  onSignOut,
  onNavigate,
}: RailProps) {
  const { t } = useLanguage();
  return (
    <div className="flex h-full w-full flex-col items-center py-4 glass-rail">
      <Link
        href="/"
        onClick={onNavigate}
        className="mb-6 flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-background/10 shadow-[0_0_24px_rgba(59,130,246,0.18)] ring-1 ring-white/10 transition-transform hover:scale-105"
        aria-label="Up Flow"
      >
        <Image
          src="/assets/UP_LOGO_1778594851568.png"
          alt="Up Flow"
          width={36}
          height={36}
          className="w-full h-full object-contain"
          priority
        />
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-2 w-full px-1">
        {primaryNav.map(({ href, label, labelKey, icon: Icon }) => {
          const active = isActiveHref(pathname, href);
          const translatedLabel = t(labelKey) || label;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={translatedLabel}
              aria-label={translatedLabel}
              className={cn(
                "group relative flex h-9 w-9 flex-col items-center justify-center rounded-lg transition-all",
                active
                  ? "bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-foreground shadow-[0_0_24px_rgba(59,130,246,0.20)] ring-1 ring-blue-400/25"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground hover:shadow-[0_0_20px_rgba(139,92,246,0.12)]"
              )}
            >
              {active && (
                <span className="absolute left-0 h-5 w-0.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(59,130,246,0.85)]" />
              )}
              <Icon className="w-[18px] h-[18px]" />
              {active && (
                <span className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.75)]" />
              )}
            </Link>
          );
        })}

        <button
          onClick={onTogglePanel}
          title={panelOpen ? t("sidebar.hide") : t("sidebar.show")}
          aria-label={panelOpen ? t("sidebar.hide") : t("sidebar.show")}
          aria-pressed={panelOpen}
          className={cn(
            "group relative mt-1 flex h-9 w-9 items-center justify-center rounded-lg transition-all",
            panelOpen
              ? "bg-primary/15 text-primary shadow-[0_0_22px_rgba(139,92,246,0.18)] ring-1 ring-primary/25"
              : "bg-primary/20 text-foreground shadow-[0_0_22px_rgba(59,130,246,0.14)] hover:bg-primary/30"
          )}
        >
          {panelOpen ? (
            <PanelLeftClose className="w-[18px] h-[18px]" />
          ) : (
            <PanelLeftOpen className="w-[18px] h-[18px]" />
          )}
        </button>
      </nav>

      <div className="flex flex-col items-center gap-2 w-full px-1 pb-1">
        <button
          aria-label={t("sidebar.help")}
          title={t("sidebar.help")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-foreground"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={onSignOut}
          aria-label={`${t("sidebar.signOut")} (${user.name || user.email || "User"})`}
          title={`${t("sidebar.signOut")} - ${user.name || user.email || "User"}`}
          className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[10px] font-bold text-white shadow-[0_0_24px_rgba(139,92,246,0.26)] transition-opacity hover:opacity-90"
        >
          {getInitials(user.name || user.email || "U")}
        </button>
      </div>
    </div>
  );
}
