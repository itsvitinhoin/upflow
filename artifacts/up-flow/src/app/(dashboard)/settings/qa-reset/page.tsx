"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";

const RESET_CONFIRMATION = "RESET WORKSPACE DATA";

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

function canResetWorkspaceData(name: string) {
  return /\b(qa|test|testing|sandbox|e2e|personal)\b/i.test(name);
}

export default function QaResetPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<WorkspaceResponse | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((res) => res.json())
      .then((payload: WorkspaceResponse) => setData(payload))
      .catch(() => toast.error(t("qaReset.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  const current = useMemo(
    () => data?.workspaces.find((workspace) => workspace.id === data.current_workspace_id) ?? null,
    [data],
  );
  const isOwner = Boolean(data?.is_super_admin || current?.role === "owner");
  const resetAllowedForName = Boolean(current && canResetWorkspaceData(current.name));
  const canReset = Boolean(current && isOwner && resetAllowedForName && confirmation === RESET_CONFIRMATION && !resetting);

  async function resetWorkspace() {
    if (!current || !canReset) return;
    const confirmed = window.confirm(
      t("qaReset.confirm", { workspace: current.name }),
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
      if (!res.ok) throw new Error(payload.error || t("qaReset.resetFailed"));

      setLastDeleted(payload.deleted ?? null);
      setConfirmation("");
      toast.success(t("qaReset.resetComplete"));
      window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("qaReset.resetFailed"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <Header title={t("qaReset.title")} />
      <main className="mx-auto w-full max-w-4xl space-y-5 overflow-x-hidden p-4 sm:p-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("qaReset.backToSettings")}
        </Link>

        <section className="rounded-3xl border border-amber-400/30 bg-amber-500/5 p-6 shadow-lg dark:border-amber-300/20 dark:bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(15,23,42,0.92))] dark:shadow-[0_0_40px_rgba(245,158,11,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80">
                {t("qaReset.eyebrow")}
              </p>
              <h1 className="mt-3 text-3xl font-bold text-foreground">{t("qaReset.heading")}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("qaReset.description")}
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/[0.15] text-amber-200 ring-1 ring-amber-300/25">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-white/10 dark:bg-card/70 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted dark:bg-white/5" />
          ) : !current ? (
            <p className="text-sm text-muted-foreground">{t("qaReset.noActiveWorkspace")}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("qaReset.currentWorkspace")}</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{current.name}</h2>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">
                    {t("qaReset.yourRole", { role: data?.is_super_admin ? t("permissions.role.superAdmin") : t(`permissions.role.${current.role}`) })}
                  </p>
                </div>
                <span
                  className={
                    resetAllowedForName
                      ? "inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"
                      : "inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300"
                  }
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {resetAllowedForName
                    ? t("qaReset.nameVerified")
                    : t("qaReset.nameRequirement")}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  t("qaReset.scope.projects"),
                  t("qaReset.scope.clients"),
                  t("qaReset.scope.calendar"),
                  t("qaReset.scope.workflow"),
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.15]">
                    {item}
                  </div>
                ))}
              </div>

              {!isOwner ? (
                <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {t("qaReset.ownersOnly")}
                </div>
              ) : null}

              <label className="block">
                <span className="text-sm font-medium text-foreground">{t("qaReset.confirmationPhrase")}</span>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={RESET_CONFIRMATION}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 dark:border-white/10 dark:bg-black/20"
                />
              </label>

              <button
                type="button"
                onClick={resetWorkspace}
                disabled={!canReset}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/[0.35] bg-amber-500/[0.15] px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground dark:border-amber-300/30 dark:text-amber-100 dark:disabled:border-white/10 dark:disabled:bg-white/5 sm:w-auto"
              >
                <RefreshCcw className="h-4 w-4" />
                {resetting ? t("qaReset.resetting") : t("qaReset.heading")}
              </button>
            </div>
          )}
        </section>

        {lastDeleted ? (
          <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
            <h2 className="text-base font-semibold text-emerald-100">{t("qaReset.lastCompleted")}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {Object.entries(lastDeleted)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <div key={key} className="rounded-xl border border-border bg-muted/30 px-3 py-2 dark:border-white/10 dark:bg-black/10">
                    <p className="text-xs text-emerald-100/[0.65]">{key.replaceAll("_", " ")}</p>
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
