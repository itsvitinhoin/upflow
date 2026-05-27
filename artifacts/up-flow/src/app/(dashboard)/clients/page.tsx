"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  PackageCheck,
  Plus,
  RefreshCcw,
  Users,
} from "lucide-react";
import Header from "@/components/layout/header";
import CreateCompanyDialog from "@/components/dashboard/create-company-dialog";
import type { Company } from "@/lib/types";

export default function ClientsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadCompanies = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error(`Could not load clients (${res.status})`);
      const data = (await res.json()) as { items?: Company[] };
      setCompanies(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  return (
    <>
      <Header title="Clients" />
      <div className="space-y-6 overflow-x-hidden p-4 sm:p-6">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Clients</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Companies, contacts, linked work, meetings, notes, and activity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New company
          </button>
        </section>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-40 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <section className="glass rounded-xl p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Could not load clients</h3>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              <button
                type="button"
                onClick={loadCompanies}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCcw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </section>
        ) : companies.length === 0 ? (
          <section className="glass rounded-xl p-10 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-base font-semibold text-foreground">No clients yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create the first company to link projects, tasks, meetings, and notes.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New company
            </button>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/clients/${company.id}`}
                className="min-w-0 rounded-xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">{company.name}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {company.industry || company.commercial_status || company.status}
                    </p>
                  </div>
                  {company.summary?.risk_reasons.length ? (
                    <AlertCircle className="h-5 w-5 text-upflow-danger" />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" />
                  )}
                </div>

                <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-start gap-2">
                    <PackageCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {company.plan_name || "Plan not set"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {company.service_type || "Service type not set"}
                        {company.billing_cycle ? ` · ${formatBillingCycle(company.billing_cycle)}` : ""}
                      </p>
                    </div>
                  </div>
                  {company.included_services?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {company.included_services.slice(0, 4).map((service) => (
                        <span
                          key={service}
                          className="max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                        >
                          {service}
                        </span>
                      ))}
                      {company.included_services.length > 4 ? (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
                          +{company.included_services.length - 4}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No included services listed</p>
                  )}
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <MetricPill label="Projects" value={company.summary?.project_count ?? 0} />
                  <MetricPill label="Open" value={company.summary?.open_task_count ?? 0} />
                  <MetricPill label="Contract" value={money(company.contract_value)} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <Users className="h-3.5 w-3.5" />
                    {company.summary?.contact_count ?? 0} contacts
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {company.summary?.meeting_count ?? 0} meetings
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Commission {money(company.commission)}
                  </span>
                </div>

                {company.summary?.risk_reasons.length ? (
                  <p className="mt-3 flex items-center gap-1 text-xs text-upflow-danger">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {company.summary.risk_reasons.slice(0, 2).join(" · ")}
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Client plan and commercial data are up to date
                  </p>
                )}
              </Link>
            ))}
          </section>
        )}

        <button
          type="button"
          onClick={loadCompanies}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <CreateCompanyDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(company) => {
          setShowCreate(false);
          window.location.assign(`/clients/${company.id}`);
        }}
      />
    </>
  );
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="min-w-0 rounded-lg bg-white/5 px-2 py-1 text-muted-foreground">
      <span className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <span className="block truncate text-xs text-foreground">{value}</span>
    </span>
  );
}

function formatBillingCycle(value: string) {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function money(value: number | null | undefined) {
  if (value == null) return "No value";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
