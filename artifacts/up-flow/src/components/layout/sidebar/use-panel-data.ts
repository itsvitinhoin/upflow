"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logError } from "@/lib/log-error";
import type { Project, Space, Folder as FolderT } from "@/lib/types";

const COLLAPSED_KEY = "upflow.sidebar.collapsedSpaces";
const SNAPSHOT_KEY = "upflow.sidebar.snapshot";
const PANEL_CACHE_TTL_MS = 60_000;
const SMART_COLLAPSE_CHILD_LIMIT = 8;

interface PanelPayload {
  spaces: { items: Space[] };
  projects: { items: Project[] };
  folders: { items: FolderT[] };
}

let panelCache: { data: PanelPayload; loadedAt: number } | null = null;
let panelRequest: Promise<PanelPayload> | null = null;

function fetchPanelData(force = false, query = ""): Promise<PanelPayload> {
  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    return fetch(`/api/sidebar?q=${encodeURIComponent(normalizedQuery)}&limit=500`).then((r) => {
      if (!r.ok) throw new Error(`Sidebar search failed: ${r.status}`);
      return r.json() as Promise<PanelPayload>;
    });
  }

  if (
    !force &&
    panelCache &&
    Date.now() - panelCache.loadedAt < PANEL_CACHE_TTL_MS
  ) {
    return Promise.resolve(panelCache.data);
  }
  if (!force && panelRequest) return panelRequest;

  panelRequest = fetch("/api/sidebar")
    .then((r) => {
      if (!r.ok) throw new Error(`Sidebar load failed: ${r.status}`);
      return r.json() as Promise<PanelPayload>;
    })
    .then((data) => {
      panelCache = { data, loadedAt: Date.now() };
      return data;
    })
    .finally(() => {
      panelRequest = null;
    });

  return panelRequest;
}

// Loads spaces/folders/projects for the sidebar tree and keeps them in sync
// with route changes and the `upflow:sidebar-refresh` broadcast event. Also
// owns the persisted collapsed-state map and an "outside click" guard for
// the action menu so panel.tsx can stay focused on layout.
export function usePanelData(pathname: string) {
  void pathname;
  const loadRequestId = useRef(0);
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
      if (!panelCache) {
        const rawSnapshot = localStorage.getItem(SNAPSHOT_KEY);
        if (rawSnapshot) {
          const snapshot = JSON.parse(rawSnapshot) as PanelPayload;
          if (
            Array.isArray(snapshot?.spaces?.items) &&
            Array.isArray(snapshot?.folders?.items) &&
            Array.isArray(snapshot?.projects?.items)
          ) {
            panelCache = { data: snapshot, loadedAt: 0 };
            setSpaces(snapshot.spaces.items);
            setFolders(snapshot.folders.items);
            setProjects(snapshot.projects.items);
            setLoadingPanel(false);
          }
        }
      }
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

  const loadPanel = useCallback((options?: { force?: boolean; query?: string }) => {
    const query = options?.query?.trim() ?? "";
    const requestId = ++loadRequestId.current;
    if (query || !panelCache) setLoadingPanel(true);
    fetchPanelData(options?.force === true, query)
      .then((data) => {
        if (requestId !== loadRequestId.current) return;
        const nextSpaces = data.spaces.items ?? [];
        const nextProjects = data.projects.items ?? [];
        const nextFolders = data.folders.items ?? [];
        setSpaces(nextSpaces);
        setProjects(nextProjects);
        setFolders(nextFolders);
        if (!query) {
          try {
            localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data));
          } catch {
            // Snapshot persistence is best-effort only.
          }
        }
        setCollapsed((current) => {
          const next = { ...current };
          for (const folder of nextFolders) {
            if (next[folder.id] !== undefined) continue;
            const directFolderCount = nextFolders.filter((f) => f.parent_id === folder.id).length;
            const directListCount = nextProjects.filter((p) => (p.folder_id ?? null) === folder.id).length;
            if (directFolderCount + directListCount > SMART_COLLAPSE_CHILD_LIMIT) {
              next[folder.id] = true;
            }
          }
          return next;
        });
      })
      .catch((err) => logError("sidebar:loadPanel", err))
      .finally(() => {
        if (requestId === loadRequestId.current) setLoadingPanel(false);
      });
  }, []);

  // Initial fetch only. Active row state is derived from `pathname`; the tree
  // data changes only after mutations, workspace switch, or cache expiry.
  useEffect(() => {
    loadPanel();
  }, [loadPanel]);

  // Other parts of the app can request a refresh via this event.
  useEffect(() => {
    const handler = () => loadPanel({ force: true });
    window.addEventListener("upflow:sidebar-refresh", handler);
    return () => window.removeEventListener("upflow:sidebar-refresh", handler);
  }, [loadPanel]);

  useEffect(() => {
    if (!pathname) return;
    const openIds = new Set<string>();
    const openFolderAncestors = (folderId: string | null | undefined) => {
      let cursor = folderId ? folders.find((f) => f.id === folderId) : null;
      while (cursor) {
        openIds.add(cursor.id);
        openIds.add(cursor.space_id);
        cursor = cursor.parent_id ? folders.find((f) => f.id === cursor?.parent_id) : null;
      }
    };

    const folderMatch = pathname.match(/^\/folders\/([^/?#]+)/);
    const projectMatch = pathname.match(/^\/projects\/([^/?#]+)/);
    const spaceMatch = pathname.match(/^\/spaces\/([^/?#]+)/);

    if (folderMatch) {
      const folder = folders.find((f) => f.id === folderMatch[1]);
      if (folder) openFolderAncestors(folder.id);
    } else if (projectMatch) {
      const project = projects.find((p) => p.id === projectMatch[1]);
      if (project?.folder_id) openFolderAncestors(project.folder_id);
      if (project?.space_id) openIds.add(project.space_id);
      if (!project?.space_id && !project?.folder_id) openIds.add("__unassigned__");
    } else if (spaceMatch) {
      openIds.add(spaceMatch[1]);
    }

    if (openIds.size === 0) return;
    setCollapsed((current) => {
      let changed = false;
      const next = { ...current };
      for (const id of openIds) {
        if (next[id] === false) continue;
        next[id] = false;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [folders, pathname, projects]);

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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpenId(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpenId]);

  const toggleCollapse = useCallback(
    (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] })),
    [],
  );

  const collapseAll = useCallback((ids: string[]) => {
    setCollapsed((current) => {
      const next = { ...current };
      for (const id of ids) next[id] = true;
      return next;
    });
  }, []);

  const upsertSpace = useCallback((space: Space) => {
    setSpaces((current) => {
      const exists = current.some((item) => item.id === space.id);
      const next = exists
        ? current.map((item) => (item.id === space.id ? space : item))
        : [...current, space].sort((a, b) => {
            const positionDelta = (a.position ?? 0) - (b.position ?? 0);
            if (positionDelta !== 0) return positionDelta;
            return a.name.localeCompare(b.name);
          });
      if (panelCache) {
        panelCache = {
          ...panelCache,
          data: {
            ...panelCache.data,
            spaces: { ...panelCache.data.spaces, items: next },
          },
        };
      }
      return next;
    });
  }, []);

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
    collapseAll,
    upsertSpace,
  };
}
