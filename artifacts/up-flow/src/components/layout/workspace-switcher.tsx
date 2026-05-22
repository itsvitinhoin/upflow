"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/log-error";
import { getCachedJson, primeCachedJson } from "@/lib/client-cache";
import { cn } from "@/lib/utils";

interface WorkspaceLite {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
}

interface ListResponse {
  workspaces: WorkspaceLite[];
  current_workspace_id: string;
  current_role: WorkspaceLite["role"] | null;
  is_super_admin?: boolean;
}

export default function WorkspaceSwitcher({
  initialData,
}: {
  initialData?: ListResponse;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ListResponse | null>(initialData ?? null);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialData) {
      primeCachedJson("workspaces", initialData);
      return;
    }
    getCachedJson<ListResponse>("workspaces", "/api/workspaces", {
      ttlMs: 60_000,
    })
      .then((d) => setData(d))
      .catch((err) => logError("workspace-switcher:load", err));
  }, [initialData]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = data?.workspaces.find(
    (w) => w.id === data.current_workspace_id,
  );

  async function switchTo(id: string) {
    if (!data || id === data.current_workspace_id) {
      setOpen(false);
      return;
    }
    setBusy(true);
    const r = await fetch("/api/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: id }),
    });
    setBusy(false);
    if (!r.ok) {
      toast.error("Could not switch workspace");
      return;
    }
    window.location.reload();
  }

  async function createNew() {
    const name = window.prompt("Workspace name")?.trim();
    if (!name) return;
    setBusy(true);
    const r = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error || "Could not create workspace");
      return;
    }
    const ws = (await r.json()) as { id: string };
    await fetch("/api/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: ws.id }),
    });
    window.location.reload();
  }

  if (!data) {
    return (
      <div className="mx-3 mt-3 mb-1 px-2.5 py-2 rounded-lg bg-white/5 text-xs text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative mx-3 mt-3 mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          <p className="text-sm font-medium text-foreground truncate">
            {current?.name ?? "—"}
          </p>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-white/10 bg-popover shadow-lg overflow-hidden">
          <ul className="max-h-64 overflow-y-auto py-1">
            {data.workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => switchTo(w.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-white/5",
                    w.id === data.current_workspace_id && "bg-white/5",
                  )}
                >
                  <span className="truncate text-foreground">{w.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {w.role}
                    </span>
                    {w.id === data.current_workspace_id && (
                      <Check className="w-3.5 h-3.5 text-foreground" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/10">
            <button
              type="button"
              onClick={createNew}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-3.5 h-3.5" /> New workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
