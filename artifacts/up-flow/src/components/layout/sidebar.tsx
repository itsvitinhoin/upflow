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
  Menu,
  X,
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
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const Rail = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col items-center w-full h-full bg-sidebar py-4">
      <Link
        href="/"
        onClick={onNavigate}
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
              onClick={onNavigate}
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
              <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-border shadow-md hidden md:block">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-1 w-full px-2 pb-1">
        <button
          aria-label="Settings"
          title="Settings"
          className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
        <button
          aria-label="Help"
          title="Help"
          className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={handleSignOut}
          aria-label="Sign out"
          title="Sign out"
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
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-[64px] flex-shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <Rail />
      </aside>

      <div className="md:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          className="bg-card border border-border text-foreground p-2 rounded-lg shadow-lg"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed left-0 top-0 h-full w-[64px] z-50 shadow-2xl border-r border-sidebar-border">
            <Rail onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
