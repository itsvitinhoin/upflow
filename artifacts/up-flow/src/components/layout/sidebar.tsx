"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log-error";
import { cn } from "@/lib/utils";
import type { AppUser } from "@/lib/types";
import { Rail } from "@/components/layout/sidebar/rail";
import Panel from "@/components/layout/sidebar/panel";

interface SidebarProps {
  user: AppUser;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: "owner" | "admin" | "member";
  }>;
}

const PANEL_KEY = "upflow.sidebar.spacesOpen";

export default function Sidebar({ user, workspaces }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const v = localStorage.getItem(PANEL_KEY);
      if (v === "1" || v === "0") {
        setPanelOpen(v === "1");
      } else if (v !== null) {
        localStorage.removeItem(PANEL_KEY);
        setPanelOpen(true);
      }
    } catch {
      // localStorage unavailable (SSR, privacy modes) — use defaults.
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(PANEL_KEY, panelOpen ? "1" : "0");
    } catch {
      // localStorage unavailable — panel state simply won't persist.
    }
  }, [mounted, panelOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      await supabase.auth.signOut();
      toast.success("Signed out");
      window.location.assign("/login");
    } catch (err) {
      logError("sidebar:sign-out", err);
      toast.error("Sign-out failed; please try again");
      setSigningOut(false);
    }
  };

  const renderRail = (onNavigate?: () => void) => (
    <Rail
      user={user}
      pathname={pathname}
      panelOpen={panelOpen}
      onTogglePanel={() => setPanelOpen((v) => !v)}
      onSignOut={handleSignOut}
      onNavigate={onNavigate}
    />
  );

  if (!mounted) {
    return (
      <aside className="hidden md:flex flex-shrink-0" aria-hidden="true">
        <div className="w-[48px] flex glass-rail" />
        <div className="w-[240px] flex glass-rail" />
      </aside>
    );
  }

  return (
    <>
      <aside className="hidden md:flex flex-shrink-0">
        <div className="w-[48px] flex">{renderRail()}</div>
        <div
          className={cn(
            "grid overflow-hidden transition-[width,opacity] duration-200 ease-out",
            panelOpen ? "w-[240px] opacity-100" : "w-0 opacity-0",
          )}
          aria-hidden={!panelOpen}
        >
          <div className="w-[240px] flex">
            <Panel
              pathname={pathname}
              workspaces={workspaces}
              currentWorkspaceId={user.currentWorkspaceId ?? ""}
              currentRole={user.currentRole ?? null}
              onRequestClose={() => setPanelOpen(false)}
            />
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setPanelOpen((value) => !value)}
        aria-label={panelOpen ? "Hide sidebar" : "Show sidebar"}
        aria-pressed={panelOpen}
        title={panelOpen ? "Hide sidebar" : "Show sidebar"}
        className={cn(
          "fixed top-4 z-50 hidden h-9 items-center gap-2 rounded-r-xl border border-l-0 border-white/10 bg-card/95 px-3 text-xs font-semibold text-foreground shadow-lg shadow-black/20 backdrop-blur transition-[left,background-color,border-color] duration-200 hover:border-primary/50 hover:bg-card md:flex",
          panelOpen ? "left-[288px]" : "left-[48px]",
        )}
      >
        {panelOpen ? (
          <PanelLeftClose className="h-4 w-4 text-primary" />
        ) : (
          <PanelLeftOpen className="h-4 w-4 text-primary" />
        )}
        {panelOpen ? "Hide sidebar" : "Show sidebar"}
      </button>

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
          <aside className="md:hidden fixed left-0 top-0 h-full z-50 shadow-2xl border-r border-sidebar-border flex">
            <div className="w-[48px] flex">{renderRail(() => setMobileOpen(false))}</div>
            <div className="w-[240px] flex">
              <Panel
                pathname={pathname}
                workspaces={workspaces}
                currentWorkspaceId={user.currentWorkspaceId ?? ""}
                currentRole={user.currentRole ?? null}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
