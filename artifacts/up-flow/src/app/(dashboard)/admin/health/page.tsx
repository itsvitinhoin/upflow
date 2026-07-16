"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import Header from "@/components/layout/header";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

type HealthCheck = {
  ok: boolean;
  label: string;
  message: string;
};

type HealthPayload = {
  status: "ok" | "degraded";
  ready: boolean;
  checked_at: string;
  checks: Record<string, HealthCheck>;
  rollout_steps?: Array<{
    title: string;
    detail: string;
  }>;
};

export default function AdminHealthPage() {
  const { language, t } = useLanguage();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("adminHealth.checkFailed", { status: res.status }));
      setPayload(data as HealthPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminHealth.couldNotLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Header title={t("adminHealth.title")} />
      <main className="mx-auto w-full max-w-5xl space-y-5 overflow-x-hidden p-4 sm:p-6">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(124,102,255,0.16),rgba(31,162,124,0.08))] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t("adminHealth.eyebrow")}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-foreground">
                {t("adminHealth.heading")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {t("adminHealth.description")}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {t("common.refresh")}
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-upflow-danger/30 bg-upflow-danger/10 px-4 py-3 text-sm text-upflow-danger">
            {error}
          </div>
        )}

        {payload && (
          <>
            <section
              className={cn(
                "rounded-2xl border p-4",
                payload.ready
                  ? "border-upflow-success/30 bg-upflow-success/10"
                  : "border-upflow-warning/30 bg-upflow-warning/10",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {payload.ready ? t("adminHealth.ready") : t("adminHealth.blocked")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {payload.ready
                      ? t("adminHealth.readyDescription")
                      : t("adminHealth.blockedDescription")}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("adminHealth.checked", { date: new Date(payload.checked_at).toLocaleString(locale) })}
                </p>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              {Object.entries(payload.checks).map(([key, check]) => (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border bg-white/[0.03] p-4",
                    check.ok ? "border-upflow-success/25" : "border-upflow-warning/30",
                  )}
                >
                  <div className="flex items-start gap-3">
                    {check.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-upflow-success" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-upflow-warning" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{check.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {check.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-foreground">
                {t("adminHealth.finalSequence")}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {(payload.rollout_steps ?? []).map((step, index) => (
                  <div key={step.title} className="rounded-xl border border-white/10 bg-background/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      {t("adminHealth.step", { number: index + 1 })}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
