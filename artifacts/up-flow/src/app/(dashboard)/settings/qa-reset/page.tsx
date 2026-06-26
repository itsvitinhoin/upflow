"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/header";

const RESET_CONFIRMATION = "RESET QA WORKSPACE";

interface WorkspaceLite {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member" | "guest";
}

interface WorkspaceResponse {
  workspaces: WorkspaceLite[];
  current_workspace_id: string;
  current_role: WorkspaceLite["role"] | null;
  is_super_admin?: boolean;
}

interface ResetResponse {
  success?: boolean;
  error?: string;
  deleted?: Record<string, number>;
}

function isTestWorkspaceName(name: string) {
  return /\b(qa|test|testing|sandbox|e2e)\b/i.test(name);
}

export default function QaResetPage() {
  const [data, setData] = useState<WorkspaceResponse | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((res) => res.json())
      .then((payload: WorkspaceResponse) => setData(payload))
      .catch(() => toast.error("Could not load workspace data."))
      .finally(() => setLoading(false));
  }, []);

  const current = useMemo(
    () => data?.workspaces.find((workspace) => workspace.id === data.current_workspace_id) ?? null,
    [data],
  );
  const isOwner = Boolean(data?.is_super_admin || current?.role === "owner");
  const isTestWorkspace = Boolean(current && isTestWorkspaceName(current.name));
  const canReset = Boolean(current && isOwner && isTestWorkspace && confirmation === RESET_CONFIRMATION && !resetting);

  async function resetWorkspace() {
    if (!current || !canReset) return;
    const confirmed = window.confirm(
      `Reset "${current.name}"?\n\nThis clears projects, tasks, clients, docs, time, calendar, approvals, automations, reports, spaces, folders, departments, notifications, and activity history. Workspace users and invites stay intact.`,
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      const res = await fetch(`/api/workspaces/${current.id}/reset-test-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = (await res.json().catch(() => ({}))) as ResetResponse;
      if (!res.ok) throw new Error(payload.error || "Could not reset this workspace.");

      setLastDeleted(payload.deleted ?? null);
      setConfirmation("");
      toast.success("QA workspace data reset.");
      window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset this workspace.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <Header title="QA reset" />
      <main className="mx-auto w-full max-w-4xl space-y-5 overflow-x-hidden p-4 sm:p-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to settings
        </Link>

        <section className="rounded-3xl border border-amber-300/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(15,23,42,0.92))] p-6 shadow-[0_0_40px_rgba(245,158,11,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80">
                Test workspace only
              </p>
              <h1 className="mt-3 text-3xl font-bold text-foreground">Reset QA workspace data</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Use this to start an end-to-end UpFlow test run from a clean workspace while keeping users,
                roles, invites, and workspace access intact.
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200 ring-1 ring-amber-300/25">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-card/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-white/5" />
          ) : !current ? (
            <p className="text-sm text-muted-foreground">No active workspace was found.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Current workspace</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{current.name}</h2>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">
                    Your role: {data?.is_super_admin ? "super admin" : current.role}
                  </p>
                </div>
                <span
                  className={
                    isTestWorkspace
                      ? "inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"
                      : "inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300"
                  }
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isTestWorkspace ? "QA name verified" : "Name must include QA, Test, Sandbox, or E2E"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Projects, tasks, lists, folders, and spaces",
                  "Clients, contacts, notes, reports, and docs",
                  "Calendar events, tracked time, notifications, and activity",
                  "Approvals, workflow statuses, automations, goals, templates, saved views, and departments",
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>

              {!isOwner ? (
                <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                  Only workspace owners can reset QA data.
                </div>
              ) : null}

              <label className="block">
                <span className="text-sm font-medium text-foreground">Confirmation phrase</span>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={RESET_CONFIRMATION}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-foreground outline-none transition focus:border-amber-300/40 focus:ring-2 focus:ring-amber-300/15"
                />
              </label>

              <button
                type="button"
                onClick={resetWorkspace}
                disabled={!canReset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-muted-foreground sm:w-auto"
              >
                <RefreshCcw className="h-4 w-4" />
                {resetting ? "Resetting..." : "Reset QA workspace data"}
              </button>
            </div>
          )}
        </section>

        {lastDeleted ? (
          <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
            <h2 className="text-base font-semibold text-emerald-100">Last reset completed</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {Object.entries(lastDeleted)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <div key={key} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                    <p className="text-xs text-emerald-100/65">{key.replaceAll("_", " ")}</p>
                    <p className="text-lg font-bold text-emerald-50">{count}</p>
                  </div>
                ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
