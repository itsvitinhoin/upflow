"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log-error";
import type { AppUser } from "@/lib/types";
import { Rail } from "@/components/layout/sidebar/rail";
import Panel from "@/components/layout/sidebar/panel";

interface SidebarProps {
  user: AppUser;
}

const PANEL_KEY = "upflow.sidebar.spacesOpen";

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(PANEL_KEY);
      if (v !== null) setPanelOpen(v === "1");
    } catch {
      // localStorage unavailable (SSR, privacy modes) — use defaults.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_KEY, panelOpen ? "1" : "0");
    } catch {
      // localStorage unavailable — panel state simply won't persist.
    }
  }, [panelOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      toast.success("Signed out");
      router.push("/login");
      router.refresh();
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

  return (
    <>
      <aside className="hidden md:flex flex-shrink-0">
        <div className="w-[48px] flex">{renderRail()}</div>
        {panelOpen && (
          <div className="w-[240px] flex">
            <Panel pathname={pathname} />
          </div>
        )}
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
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
