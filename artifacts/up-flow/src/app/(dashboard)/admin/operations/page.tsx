"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, FileText, HeartPulse, RefreshCcw, ShieldCheck, UserPlus } from "lucide-react";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";

interface OperationsPayload {
  checked_at: string;
  counts: {
    failed_automations: number;
    approvals_waiting: number;
    report_approvals_waiting: number;
    clients_at_risk: number;
    invite_failures: number;
    permission_changes_7d: number;
  };
  latest_runs: Array<{
    id: string;
    status: string;
    trigger: string;
    action_type: string;
    executed: number;
    skipped: number;
    started_at: string;
    rule?: { name: string } | null;
  }>;
  clients_at_risk: Array<{ id: string; name: string }>;
}

export default function OperationsPage() {
  const { t } = useLanguage();
  const [payload, setPayload] = useState<OperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/operations", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as OperationsPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || t("adminOps.couldNotLoadWithStatus", { status: res.status }));
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminOps.couldNotLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Header title={t("adminOps.title")} />
      <main className="space-y-5 p-4 sm:p-6">
        <section className="rounded-2xl border border-blue-400/20 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.2),transparent_34%),rgba(2,6,23,0.84)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                <ShieldCheck className="h-4 w-4" />
                {t("adminOps.adminCenter")}
              </div>
              <h1 className="mt-4 text-2xl font-bold text-white">{t("adminOps.heading")}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {t("adminOps.description")}
              </p>
            </div>
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <RefreshCcw className="h-4 w-4" />
              {t("common.refresh")}
            </button>
          </div>
        </section>

        {error ? <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

        {loading || !payload ? (
          <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <OpsCard label={t("adminOps.failedAutomations")} value={payload.counts.failed_automations} icon={<Bot className="h-4 w-4" />} danger />
              <OpsCard label={t("adminOps.approvalsWaiting")} value={payload.counts.approvals_waiting} icon={<CheckCircle2 className="h-4 w-4" />} />
              <OpsCard label={t("adminOps.reportsWaiting")} value={payload.counts.report_approvals_waiting} icon={<FileText className="h-4 w-4" />} />
              <OpsCard label={t("adminOps.clientsAtRisk")} value={payload.counts.clients_at_risk} icon={<HeartPulse className="h-4 w-4" />} danger />
              <OpsCard label={t("adminOps.inviteFailures")} value={payload.counts.invite_failures} icon={<UserPlus className="h-4 w-4" />} danger />
              <OpsCard label={t("adminOps.permissionChanges")} value={payload.counts.permission_changes_7d} icon={<ShieldCheck className="h-4 w-4" />} />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <h2 className="text-sm font-semibold text-white">{t("adminOps.latestRuns")}</h2>
                <div className="mt-3 divide-y divide-white/10">
                  {payload.latest_runs.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">{t("adminOps.noRuns")}</p>
                  ) : (
                    payload.latest_runs.map((run) => (
                      <div key={run.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto]">
                        <div>
                          <p className="font-semibold text-white">{run.rule?.name ?? run.trigger}</p>
                          <p className="text-xs text-muted-foreground">{run.action_type} - {run.status}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("adminOps.execution", { executed: run.executed, skipped: run.skipped })}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <h2 className="text-sm font-semibold text-white">{t("adminOps.clientsNeedAttention")}</h2>
                  <div className="mt-3 space-y-2">
                    {payload.clients_at_risk.length === 0 ? (
                      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-xs text-muted-foreground">{t("adminOps.noClientRisk")}</p>
                    ) : (
                      payload.clients_at_risk.map((client) => (
                        <Link key={client.id} href={`/clients/${client.id}`} className="block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-blue-100 hover:bg-white/[0.06]">
                          {client.name}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <h2 className="text-sm font-semibold text-white">{t("adminOps.hardVerification")}</h2>
                  <div className="mt-3 grid gap-2">
                    <Link href="/api/health" className="text-sm text-blue-100 hover:text-white">{t("adminOps.openHealthApi")}</Link>
                    <Link href="/admin/health" className="text-sm text-blue-100 hover:text-white">{t("adminOps.openAdminHealth")}</Link>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function OpsCard({ label, value, icon, danger = false }: { label: string; value: number; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className={danger && value > 0 ? "rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-100" : "rounded-xl border border-white/10 bg-white/[0.035] p-4 text-blue-100"}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
        <span>{label}</span>
        {value > 0 && danger ? <AlertTriangle className="h-4 w-4" /> : icon}
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
