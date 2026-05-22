"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Building2, DollarSign, Plus, RefreshCcw } from "lucide-react";
import Header from "@/components/layout/header";
import CreateCompanyDialog from "@/components/dashboard/create-company-dialog";
import type { Company } from "@/lib/types";

export default function ClientsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/companies");
      const data = (await res.json()) as { items?: Company[] };
      setCompanies(data.items ?? []);
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
      <div className="p-6 space-y-6">
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
              <div key={item} className="h-28 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
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
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/clients/${company.id}`}
                className="rounded-xl border border-white/5 bg-white/[0.03] p-4 hover:bg-white/[0.06]"
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
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-muted-foreground">
                    {company.summary?.project_count ?? 0} projects
                  </span>
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-muted-foreground">
                    {company.summary?.open_task_count ?? 0} open
                  </span>
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-muted-foreground">
                    {money(company.contract_value)}
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
                    Commission {money(company.commission)}
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

function money(value: number | null | undefined) {
  if (value == null) return "No value";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
