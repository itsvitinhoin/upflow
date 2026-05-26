"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
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
