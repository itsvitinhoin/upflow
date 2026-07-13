"use client";

import Link from "next/link";
import Image from "next/image";
import {
  LayoutGrid,
  Users,
  Clock,
  Inbox,
  Calendar,
  DoorOpen,
  Kanban,
  Building2,
  Activity,
  ClipboardCheck,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
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
  { href: "/sala-de-reuniao", label: "Sala de Reuniao", labelKey: "nav.meetingRoom", icon: DoorOpen },
  { href: "/projects", label: "Projects", labelKey: "nav.projects", icon: Kanban },
  { href: "/clients", label: "Clients", labelKey: "nav.clients", icon: Building2 },
  { href: "/onboarding", label: "Onboarding", labelKey: "nav.onboarding", icon: ClipboardCheck },
  { href: "/activity", label: "Activity", labelKey: "nav.activity", icon: Activity },
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
    <div className="flex h-full w-full flex-col items-center glass-rail">
      <div className="flex h-20 w-full shrink-0 items-center justify-center border-b border-blue-300/10">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-background/10 shadow-[0_0_24px_rgba(59,130,246,0.18)] ring-1 ring-white/10 transition-transform hover:scale-105"
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
      </div>

      <nav className="flex-1 flex flex-col items-center gap-2 w-full px-1 py-4">
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
                "group relative flex h-9 w-9 flex-col items-center justify-center rounded-xl transition-all",
                active
                  ? "bg-gradient-to-br from-blue-600/55 to-violet-600/35 text-white shadow-[0_0_28px_rgba(37,99,235,0.34)] ring-1 ring-blue-300/30"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground hover:shadow-[0_0_22px_rgba(139,92,246,0.16)]"
              )}
            >
              {active && (
                <span className="absolute left-0 h-5 w-0.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(59,130,246,0.85)]" />
              )}
              <Icon className={cn("w-[18px] h-[18px]", active && "drop-shadow-[0_0_8px_rgba(147,197,253,0.85)]")} />
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
            "group relative mt-1 flex h-9 w-9 items-center justify-center rounded-xl transition-all",
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
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-label={t("sidebar.settings")}
          title={t("sidebar.settings")}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-foreground hover:shadow-[0_0_22px_rgba(139,92,246,0.16)]",
            isActiveHref(pathname, "/settings") &&
              "bg-gradient-to-br from-blue-600/45 to-violet-600/28 text-white shadow-[0_0_24px_rgba(37,99,235,0.28)] ring-1 ring-blue-300/25",
          )}
        >
          <Settings2 className="w-[18px] h-[18px]" />
        </Link>
        <button
          onClick={onSignOut}
          aria-label={t("sidebar.signOut")}
          title={t("sidebar.signOut")}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-rose-500/10 hover:text-rose-100 hover:shadow-[0_0_22px_rgba(244,63,94,0.14)]"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
        <button
          aria-label={t("sidebar.help")}
          title={t("sidebar.help")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/[0.06] hover:text-foreground"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-label={user.name || user.email || "User"}
          title={user.name || user.email || "User"}
          className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[10px] font-bold text-white shadow-[0_0_24px_rgba(139,92,246,0.26)] transition-opacity hover:opacity-90"
        >
          {getInitials(user.name || user.email || "U")}
        </Link>
      </div>
    </div>
  );
}
