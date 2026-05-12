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
        className="flex items-center justify-center w-9 h-9 bg-primary rounded-xl mb-6 shadow-lg shadow-primary/20"
        aria-label="Up Flow"
      >
        <Zap className="w-4 h-4 text-white" fill="currentColor" />
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-2 w-full px-1">
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
              <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-border shadow-md hidden md:block">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-2 w-full px-1 pb-1">
        <button
          aria-label="Settings"
          title="Settings"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
        <button
          aria-label="Help"
          title="Help"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        <button
          onClick={handleSignOut}
          aria-label={`Sign out (${user.name || user.email || "User"})`}
          title={`Sign out · ${user.name || user.email || "User"}`}
          className="mt-2 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-[10px] font-bold hover:opacity-90 transition-opacity"
        >
          {getInitials(user.name || user.email || "U")}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-[48px] flex-shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
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
          <aside className="md:hidden fixed left-0 top-0 h-full w-[48px] z-50 shadow-2xl border-r border-sidebar-border">
            <Rail onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
