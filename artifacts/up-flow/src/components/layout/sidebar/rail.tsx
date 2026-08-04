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
  {
    href: "/",
    label: "Dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutGrid,
  },
  { href: "/team", label: "Team", labelKey: "nav.team", icon: Users },
  {
    href: "/time",
    label: "Time tracking",
    labelKey: "nav.timeTracking",
    icon: Clock,
  },
  { href: "/inbox", label: "Inbox", labelKey: "nav.inbox", icon: Inbox },
  {
    href: "/calendar",
    label: "Calendar",
    labelKey: "nav.calendar",
    icon: Calendar,
  },
  {
    href: "/sala-de-reuniao",
    label: "Sala de Reuniao",
    labelKey: "nav.meetingRoom",
    icon: DoorOpen,
  },
  {
    href: "/projects",
    label: "Projects",
    labelKey: "nav.projects",
    icon: Kanban,
  },
  {
    href: "/clients",
    label: "Clients",
    labelKey: "nav.clients",
    icon: Building2,
  },
  {
    href: "/onboarding",
    label: "Onboarding",
    labelKey: "nav.onboarding",
    icon: ClipboardCheck,
  },
  {
    href: "/activity",
    label: "Activity",
    labelKey: "nav.activity",
    icon: Activity,
  },
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
    <div className="glass-rail flex h-full w-full flex-col p-1.5">
      <div className="flex min-h-0 flex-1 flex-col items-center rounded-[10px] bg-[#16132f] px-1 pb-1.5 pt-2 text-[#e9e7ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_30px_rgba(0,0,0,0.28)]">
        <div className="flex h-11 w-full shrink-0 items-center justify-center">
          <Link
            href="/"
            onClick={onNavigate}
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white p-1 shadow-[0_4px_16px_rgba(0,0,0,0.24)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
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

      <nav
        data-testid="sidebar-rail-navigation"
        className="mt-2 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain px-0.5 py-1"
      >
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
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex min-h-[48px] w-full flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-center text-[9px] font-semibold leading-[10px] outline-none transition-all focus-visible:ring-2 focus-visible:ring-white/80",
                active
                  ? "bg-white text-[#171331] shadow-[0_6px_20px_rgba(0,0,0,0.22)]"
                  : "text-[#d9d5fb] hover:bg-white/[0.12] hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "h-[17px] w-[17px] shrink-0 stroke-[1.8]",
                  active ? "text-[#21184a]" : "text-[#e6e3ff]",
                )}
              />
              <span
                data-testid="sidebar-rail-item-label"
                className="w-full truncate text-center"
              >
                {translatedLabel}
              </span>
            </Link>
          );
        })}

        <button
          onClick={onTogglePanel}
          title={panelOpen ? t("sidebar.hide") : t("sidebar.show")}
          aria-label={panelOpen ? t("sidebar.hide") : t("sidebar.show")}
          aria-pressed={panelOpen}
          className={cn(
            "group relative mt-1 flex min-h-[48px] w-full flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-center text-[9px] font-semibold leading-[10px] outline-none transition-all focus-visible:ring-2 focus-visible:ring-white/80",
            panelOpen
              ? "bg-white/[0.16] text-white"
              : "text-[#d9d5fb] hover:bg-white/[0.12] hover:text-white",
          )}
        >
          {panelOpen ? (
            <PanelLeftClose className="h-[17px] w-[17px] stroke-[1.8]" />
          ) : (
            <PanelLeftOpen className="h-[17px] w-[17px] stroke-[1.8]" />
          )}
          <span>{t("sidebar.more")}</span>
        </button>
      </nav>

      <div className="mt-1 flex w-full shrink-0 flex-col items-center gap-1 border-t border-white/[0.1] pt-1.5">
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-label={t("sidebar.settings")}
          title={t("sidebar.settings")}
          className={cn(
            "flex min-h-[46px] w-full flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-center text-[9px] font-semibold leading-[10px] text-[#d9d5fb] outline-none transition-all hover:bg-white/[0.12] hover:text-white focus-visible:ring-2 focus-visible:ring-white/80",
            isActiveHref(pathname, "/settings") &&
              "bg-white text-[#171331] shadow-[0_6px_20px_rgba(0,0,0,0.22)]",
          )}
        >
          <Settings2 className="h-[17px] w-[17px] stroke-[1.8]" />
          <span>{t("sidebar.settings")}</span>
        </Link>
        <button
          onClick={onSignOut}
          aria-label={t("sidebar.signOut")}
          title={t("sidebar.signOut")}
          className="flex min-h-[46px] w-full flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-center text-[9px] font-semibold leading-[10px] text-[#d9d5fb] outline-none transition-all hover:bg-rose-500/20 hover:text-white focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <LogOut className="h-[17px] w-[17px] stroke-[1.8]" />
          <span>{t("sidebar.signOut")}</span>
        </button>
        <Link
          href="/docs"
          onClick={onNavigate}
          aria-label={t("sidebar.help")}
          title={t("sidebar.help")}
          className="flex min-h-[46px] w-full flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-center text-[9px] font-semibold leading-[10px] text-[#d9d5fb] outline-none transition-all hover:bg-white/[0.12] hover:text-white focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <HelpCircle className="h-[17px] w-[17px] stroke-[1.8]" />
          <span>{t("sidebar.help")}</span>
        </Link>
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-label={user.name || user.email || "User"}
          title={user.name || user.email || "User"}
          className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[9px] font-bold text-[#21184a] shadow-[0_3px_12px_rgba(0,0,0,0.22)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          {getInitials(user.name || user.email || "U")}
        </Link>
      </div>
      </div>
    </div>
  );
}
