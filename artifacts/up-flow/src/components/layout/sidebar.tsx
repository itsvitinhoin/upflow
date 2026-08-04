"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log-error";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import type { AppUser } from "@/lib/types";
import { Rail } from "@/components/layout/sidebar/rail";
import Panel from "@/components/layout/sidebar/panel";

interface SidebarProps {
  user: AppUser;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    role: "owner" | "admin" | "member" | "guest";
  }>;
}

const PANEL_KEY = "upflow.sidebar.spacesOpen";

export default function Sidebar({ user, workspaces }: SidebarProps) {
  const { t } = useLanguage();
  const pathname = usePathname() ?? "";
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const closeMobileNavigation = useCallback((restoreFocus = true) => {
    setMobileOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => mobileToggleRef.current?.focus());
    }
  }, []);
  const closeMobileNavigationAfterNavigate = useCallback(
    () => closeMobileNavigation(false),
    [closeMobileNavigation],
  );

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
        setPanelOpen(false);
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

  useEffect(() => {
    if (!mobileOpen) return;

    mobileCloseRef.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeMobileNavigation();
        return;
      }

      if (event.key !== "Tab" || !mobileDialogRef.current) return;
      const focusables = mobileDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [closeMobileNavigation, mobileOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      await supabase.auth.signOut();
      toast.success(t("auth.signedOut"));
      window.location.assign("/login");
    } catch (err) {
      logError("sidebar:sign-out", err);
      toast.error(t("auth.signOutFailed"));
      setSigningOut(false);
    }
  };

  const renderRail = (
    onNavigate?: () => void,
    options: { panelId?: string; showPanelToggle?: boolean } = {},
  ) => (
    <Rail
      user={user}
      pathname={pathname}
      panelOpen={panelOpen}
      panelId={options.panelId}
      showPanelToggle={options.showPanelToggle}
      onTogglePanel={() => setPanelOpen((v) => !v)}
      onSignOut={handleSignOut}
      onNavigate={onNavigate}
    />
  );

  if (!mounted) {
    return (
      <aside className="hidden md:flex flex-shrink-0" aria-hidden="true">
        <div className="w-[64px] flex glass-rail" />
      </aside>
    );
  }

  return (
    <>
      <aside className="hidden h-dvh min-h-0 flex-shrink-0 overflow-hidden md:flex">
        <div className="flex min-h-0 w-[64px]">
          {renderRail(undefined, { panelId: "desktop-sidebar-panel" })}
        </div>
        <div
          id="desktop-sidebar-panel"
          className={cn(
            "grid min-h-0 overflow-hidden transition-[width,opacity] duration-200 ease-out",
            panelOpen ? "w-[272px] opacity-100" : "w-0 opacity-0",
          )}
          aria-hidden={!panelOpen}
        >
          <div className="flex min-h-0 w-[272px]">
            <Panel
              pathname={pathname}
              workspaces={workspaces}
              currentWorkspaceId={user.currentWorkspaceId ?? ""}
              currentUserId={user.id}
              currentRole={user.currentRole ?? null}
              userName={user.name || user.email}
              isSuperAdmin={user.isSuperAdmin === true}
              onRequestClose={() => setPanelOpen(false)}
              onSignOut={handleSignOut}
              signingOut={signingOut}
            />
          </div>
        </div>
      </aside>

      {!mobileOpen && (
        <div className="fixed left-3 top-3 z-[60] md:hidden">
          <button
            ref={mobileToggleRef}
            onClick={() => setMobileOpen(true)}
            aria-label={t("sidebar.openNavigation")}
            aria-expanded={false}
            aria-controls="mobile-sidebar-dialog"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      )}

      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => closeMobileNavigation()}
          />
          <aside
            ref={mobileDialogRef}
            id="mobile-sidebar-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("sidebar.navigation")}
            className="fixed left-0 top-0 z-50 flex h-dvh min-h-0 w-[min(100vw,336px)] overflow-hidden border-r border-sidebar-border shadow-2xl md:hidden"
          >
            <button
              ref={mobileCloseRef}
              type="button"
              onClick={() => closeMobileNavigation()}
              aria-label={t("sidebar.closeNavigation")}
              className="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex min-h-0 w-[64px]">
              {renderRail(closeMobileNavigationAfterNavigate, {
                showPanelToggle: false,
              })}
            </div>
            <div className="min-h-0 min-w-0 flex-1">
              <Panel
                pathname={pathname}
                workspaces={workspaces}
                currentWorkspaceId={user.currentWorkspaceId ?? ""}
                currentUserId={user.id}
                currentRole={user.currentRole ?? null}
                userName={user.name || user.email}
                isSuperAdmin={user.isSuperAdmin === true}
                onNavigate={closeMobileNavigationAfterNavigate}
                onSignOut={handleSignOut}
                signingOut={signingOut}
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
