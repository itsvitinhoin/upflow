"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Zap,
  LayoutGrid,
  Users,
  Clock,
  Inbox,
  Calendar,
  Kanban,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/types";

interface SidebarProps {
  user: AppUser;
}

const primaryNav = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/team", label: "Team", icon: Users },
  { href: "/time", label: "Time tracking", icon: Clock },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/projects", label: "Projects", icon: Kanban },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || (pathname?.startsWith(href + "/") ?? false);

  return (
    <aside className="hidden md:flex w-[64px] flex-shrink-0 flex-col items-center bg-sidebar border-r border-sidebar-border py-4">
      <Link
        href="/"
        className="flex items-center justify-center w-10 h-10 bg-primary rounded-xl mb-6 shadow-lg shadow-primary/20"
        aria-label="Up Flow"
      >
        <Zap className="w-5 h-5 text-white" fill="currentColor" />
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors group",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
              )}
              <Icon className="w-[18px] h-[18px]" />
              <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-border shadow-md">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1 w-full px-2 pb-1">
        <button
          title="Settings"
          aria-label="Settings"
          className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
        <button
          title="Help"
          aria-label="Help"
          className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={handleSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
        <div
          className="mt-2 flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white text-xs font-bold"
          title={user.name || user.email || "User"}
        >
          {getInitials(user.name || user.email || "U")}
        </div>
      </div>
    </aside>
  );
}
