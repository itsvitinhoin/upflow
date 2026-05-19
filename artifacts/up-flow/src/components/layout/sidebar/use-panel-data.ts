"use client";

import { useCallback, useEffect, useState } from "react";
import { logError } from "@/lib/log-error";
import type { Project, Space, Folder as FolderT } from "@/lib/types";

const COLLAPSED_KEY = "upflow.sidebar.collapsedSpaces";

// Loads spaces/folders/projects for the sidebar tree and keeps them in sync
// with route changes and the `upflow:sidebar-refresh` broadcast event. Also
// owns the persisted collapsed-state map and an "outside click" guard for
// the action menu so panel.tsx can stay focused on layout.
export function usePanelData(pathname: string) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [folders, setFolders] = useState<FolderT[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingPanel, setLoadingPanel] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem(COLLAPSED_KEY);
      if (c) setCollapsed(JSON.parse(c) as Record<string, boolean>);
    } catch {
      // localStorage unavailable — use defaults.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed));
    } catch {
      // localStorage unavailable — state simply won't persist.
    }
  }, [collapsed]);

  const loadPanel = useCallback(() => {
    setLoadingPanel(true);
    fetch("/api/sidebar")
      .then(
        (r) =>
          r.json() as Promise<{
            spaces: { items: Space[] };
            projects: { items: Project[] };
            folders: { items: FolderT[] };
          }>,
      )
      .then((data) => {
        setSpaces(data.spaces.items ?? []);
        setProjects(data.projects.items ?? []);
        setFolders(data.folders.items ?? []);
      })
      .catch((err) => logError("sidebar:loadPanel", err))
      .finally(() => setLoadingPanel(false));
  }, []);

  // Initial fetch + reload on every route change.
  useEffect(() => {
    loadPanel();
  }, [loadPanel, pathname]);

  // Other parts of the app can request a refresh via this event.
  useEffect(() => {
    const handler = () => loadPanel();
    window.addEventListener("upflow:sidebar-refresh", handler);
    return () => window.removeEventListener("upflow:sidebar-refresh", handler);
  }, [loadPanel]);

  // Close the action menu when clicking outside of any menu/trigger.
  useEffect(() => {
    if (!menuOpenId) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && target.closest('[role="menu"], [data-menu-trigger]')) return;
      setMenuOpenId(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", handle);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", handle);
    };
  }, [menuOpenId]);

  const toggleCollapse = useCallback(
    (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] })),
    [],
  );

  return {
    spaces,
    folders,
    projects,
    loadingPanel,
    collapsed,
    toggleCollapse,
    menuOpenId,
    setMenuOpenId,
    loadPanel,
  };
}
