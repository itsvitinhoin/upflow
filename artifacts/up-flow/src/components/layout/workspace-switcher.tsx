"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/log-error";
import { getCachedJson, primeCachedJson } from "@/lib/client-cache";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

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
  const { t } = useLanguage();
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
      toast.error(t("workspace.switchError"));
      return;
    }
    window.location.reload();
  }

  async function createNew() {
    const name = window.prompt(t("workspace.namePrompt"))?.trim();
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
      toast.error(j.error || t("workspace.createError"));
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
      <div className="mx-3 mb-2 mt-3 rounded-2xl border border-blue-300/10 bg-[#071024]/70 px-3 py-3 text-xs text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_28px_rgba(37,99,235,0.08)]">
        {t("workspace.loading")}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative mx-3 mb-2 mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-300/10 bg-[#071024]/75 px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_28px_rgba(37,99,235,0.08)] transition-all hover:border-blue-300/25 hover:bg-[#0a1430]/90 hover:shadow-[0_0_26px_rgba(59,130,246,0.14)]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[9px] uppercase tracking-[0.18em] text-blue-200/55">
            {t("sidebar.workspace")}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {current?.name ?? "—"}
          </p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-blue-100" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-blue-300/15 bg-[#070b18]/95 shadow-[0_20px_60px_rgba(0,0,0,0.45),0_0_36px_rgba(37,99,235,0.12)] backdrop-blur-xl">
          <ul className="max-h-64 overflow-y-auto py-1">
            {data.workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => switchTo(w.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm transition hover:bg-white/[0.06]",
                    w.id === data.current_workspace_id && "bg-blue-500/10 text-blue-100",
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
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
            >
              <Plus className="w-3.5 h-3.5" /> {t("workspace.new")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
