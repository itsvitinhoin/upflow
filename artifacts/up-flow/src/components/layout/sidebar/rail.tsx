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
    <div className="flex flex-col items-center w-full h-full glass-rail py-4">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center justify-center w-9 h-9 rounded-xl mb-6 overflow-hidden bg-background/10 shadow-lg shadow-primary/20"
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
                "relative flex flex-col items-center justify-center w-9 h-9 rounded-lg transition-colors group",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              {active && (
                <span className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-primary" />
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
            "group relative mt-1 flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
            panelOpen
              ? "text-primary bg-primary/15"
              : "text-foreground bg-primary/20 hover:bg-primary/30"
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
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={onSignOut}
          aria-label={`${t("sidebar.signOut")} (${user.name || user.email || "User"})`}
          title={`${t("sidebar.signOut")} - ${user.name || user.email || "User"}`}
          className="mt-2 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-[10px] font-bold hover:opacity-90 transition-opacity"
        >
          {getInitials(user.name || user.email || "U")}
        </button>
      </div>
    </div>
  );
}
