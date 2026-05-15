"use client";

import Link from "next/link";
import {
  LayoutGrid,
  Users,
  Clock,
  Inbox,
  Calendar,
  Kanban,
  Settings,
  HelpCircle,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { AppUser } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const primaryNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/team", label: "Team", icon: Users },
  { href: "/time", label: "Time tracking", icon: Clock },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/projects", label: "Projects", icon: Kanban },
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
  return (
    <div className="flex flex-col items-center w-full h-full glass-rail py-4">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center justify-center w-9 h-9 rounded-xl mb-6 overflow-hidden bg-background/10 shadow-lg shadow-primary/20"
        aria-label="Up Flow"
      >
        <img src="/assets/UP_LOGO_1778594851568.png" alt="Up Flow" className="w-full h-full object-contain" />
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-2 w-full px-1">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const active = isActiveHref(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={label}
              aria-label={label}
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
          title={panelOpen ? "Hide spaces" : "Show spaces"}
          aria-label="Toggle spaces"
          aria-pressed={panelOpen}
          className={cn(
            "mt-1 flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
            panelOpen
              ? "text-primary bg-primary/15"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="w-[18px] h-[18px]" />
        </button>
      </nav>

      <div className="flex flex-col items-center gap-2 w-full px-1 pb-1">
        <Link
          href="/settings/import"
          aria-label="Settings"
          title="Settings · ClickUp import"
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
            pathname?.startsWith("/settings")
              ? "text-foreground bg-white/10"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings className="w-[18px] h-[18px]" />
        </Link>
        <button
          aria-label="Help"
          title="Help"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={onSignOut}
          aria-label={`Sign out (${user.name || user.email || "User"})`}
          title={`Sign out · ${user.name || user.email || "User"}`}
          className="mt-2 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-[10px] font-bold hover:opacity-90 transition-opacity"
        >
          {getInitials(user.name || user.email || "U")}
        </button>
      </div>
    </div>
  );
}
