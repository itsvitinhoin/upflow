"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import Header from "@/components/layout/header";
import { cn } from "@/lib/utils";

type HealthCheck = {
  ok: boolean;
  label: string;
  message: string;
};

type HealthPayload = {
  status: "ok" | "degraded";
  checked_at: string;
  checks: Record<string, HealthCheck>;
};

export default function AdminHealthPage() {
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Health check failed (${res.status})`);
      setPayload(data as HealthPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin health.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <Header title="Admin health" />
      <main className="mx-auto w-full max-w-5xl space-y-5 overflow-x-hidden p-4 sm:p-6">
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(124,102,255,0.16),rgba(31,162,124,0.08))] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Production readiness
              </p>
              <h1 className="mt-2 text-2xl font-bold text-foreground">
                UP Flow admin health
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Operational checks for database, Supabase, Resend, app URL,
                active workspace, and Prisma migrations.
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-upflow-danger/30 bg-upflow-danger/10 px-4 py-3 text-sm text-upflow-danger">
            {error}
          </div>
        )}

        {payload && (
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
        )}
      </main>
    </>
  );
}
