"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  Crown,
  Edit3,
  HeartPulse,
  PackageCheck,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  UserRound,
  MoreHorizontal,
} from "lucide-react";
import Header from "@/components/layout/header";
import CreateCompanyDialog from "@/components/dashboard/create-company-dialog";
import { useLanguage } from "@/components/language-provider";
import type { Company } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ClientsPage() {
  const { t } = useLanguage();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error(`${t("clients.couldNotLoad")} (${res.status})`);
      const data = (await res.json()) as { items?: Company[] };
      setCompanies(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clients.couldNotLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const deleteCompany = async (company: Company) => {
    if (!window.confirm(t("clients.deleteConfirm", { name: company.name }))) return;

    try {
      const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? t("clients.couldNotDelete"));
      }
      toast.success(t("clients.deleted"));
      await loadCompanies();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("clients.couldNotDelete"));
    }
  };

  return (
    <>
      <Header title={t("clients.title")} />
      <div className="space-y-6 overflow-x-hidden p-4 sm:p-6">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t("clients.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("clients.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/clients/health"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-400/25 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 hover:bg-blue-500/15"
            >
              <HeartPulse className="h-4 w-4" />
              {t("clients.healthCenter")}
            </Link>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t("clients.startOnboarding")}
            </button>
          </div>
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
                <h3 className="text-base font-semibold text-foreground">{t("clients.couldNotLoad")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              <button
                type="button"
                onClick={loadCompanies}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCcw className="h-4 w-4" />
                {t("common.retry")}
              </button>
            </div>
          </section>
        ) : companies.length === 0 ? (
          <section className="glass rounded-xl p-10 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-base font-semibold text-foreground">{t("clients.noClients")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("clients.noClientsHint")}
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t("clients.startOnboarding")}
            </button>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {companies.map((company) => {
              const services = company.included_services ?? [];
              const visibleServices = services.slice(0, 4);
              const remainingServices = Math.max(0, services.length - visibleServices.length);
              const manager = managerName(company, t);

              return (
                <article
                  key={company.id}
                  className="group relative min-w-0 overflow-hidden rounded-xl border border-blue-400/35 bg-[#07101f]/95 shadow-[0_0_0_1px_rgba(59,130,246,0.08),0_16px_42px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-blue-300/65 hover:bg-[#091426] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.16),0_20px_56px_rgba(0,0,0,0.32)]"
                >
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(59,130,246,0.24),transparent_30%),radial-gradient(circle_at_100%_4%,rgba(99,102,241,0.16),transparent_28%)]" />
                  <span className="pointer-events-none absolute right-0 top-0 h-28 w-44 rounded-bl-full bg-blue-500/10 blur-2xl" />

                  <div className="relative p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <Link href={`/clients/${company.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-blue-300/45 bg-gradient-to-br from-blue-600/85 via-indigo-700/75 to-blue-950 text-3xl font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_26px_rgba(37,99,235,0.32)]">
                          {company.name.trim().charAt(0).toUpperCase() || "C"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200/55">
                            {t("clients.brandName")}
                          </p>
                          <h3 className="mt-1 truncate text-2xl font-bold text-white">
                            {company.name}
                          </h3>
                          <span className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            {company.commercial_status || company.status}
                          </span>
                        </div>
                      </Link>

                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={`/clients/${company.id}`}
                          aria-label={t("clients.openClient")}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200/15 bg-white/[0.05] text-blue-100/80 transition hover:border-blue-300/45 hover:bg-blue-500/15 hover:text-white"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/clients/${company.id}`}
                          aria-label={t("clients.editClient")}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200/15 bg-white/[0.05] text-blue-100/80 transition hover:border-blue-300/45 hover:bg-blue-500/15 hover:text-white"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => deleteCompany(company)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-300/20 bg-rose-500/10 text-rose-300 transition hover:border-rose-300/55 hover:bg-rose-500/15"
                          title={t("clients.deleteClient")}
                          aria-label={t("clients.deleteClient")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <Link href={`/clients/${company.id}`} className="mt-5 block space-y-4">
                      <div className="grid gap-3 rounded-xl border border-blue-200/14 bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:grid-cols-2">
                        <ClientFact
                          icon={<Building2 className="h-5 w-5" />}
                          label={t("clients.brandType")}
                          value={brandTypeValue(company, t)}
                        />
                        <ClientFact
                          icon={<Crown className="h-5 w-5" />}
                          label={t("clients.contractedPlan")}
                          value={company.plan_name || t("clients.planNotSet")}
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <PackageCheck className="h-4 w-4 text-blue-400" />
                          <p className="text-sm font-bold text-white">{t("clients.planServices")}</p>
                        </div>
                        {visibleServices.length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {visibleServices.map((service) => (
                              <PlanServiceTile key={service} service={service} />
                            ))}
                            {remainingServices > 0 ? (
                              <span className="flex min-w-0 items-center justify-center rounded-xl border border-blue-200/12 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-blue-100/70">
                                {t("clients.moreServices", { count: remainingServices })}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-blue-200/12 bg-white/[0.04] px-3 py-3 text-sm text-blue-100/55">
                            {t("clients.noIncludedServices")}
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-blue-200/12 bg-black/10 px-3 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-300 ring-1 ring-blue-300/10">
                          <UserRound className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-200/55">
                            {t("clients.responsibleManager")}
                          </p>
                          <p className="mt-0.5 truncate text-sm font-bold text-white">{manager}</p>
                        </div>
                      </div>
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <button
          type="button"
          onClick={loadCompanies}
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {t("common.refresh")}
        </button>
      </div>

      <CreateCompanyDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        mode="onboarding"
        onCreated={(company) => {
          setShowCreate(false);
          window.location.assign(`/clients/${company.id}`);
        }}
      />
    </>
  );
}

function ClientFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-blue-200/10 sm:first:border-r sm:first:pr-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-300 ring-1 ring-blue-300/10">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-200/55">
          {label}
        </p>
        <p className="mt-1 truncate text-base font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function PlanServiceTile({ service }: { service: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-xl border border-blue-200/14 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/12 text-xs font-bold text-blue-300 ring-1 ring-blue-300/10">
        {serviceInitials(service)}
      </span>
      <span className={cn("truncate", service.length > 18 && "text-xs")}>
        {service}
      </span>
    </span>
  );
}

function serviceInitials(service: string) {
  const normalized = service.trim();
  if (!normalized) return "S";
  const known: Record<string, string> = {
    "meta ads": "M",
    "google ads": "G",
    "tiktok ads": "T",
    "pinterest ads": "P",
    "up motion v.1": "U",
    "up motion v.2": "U",
    "social media": "S",
    "implantacao ia": "AI",
    "up zero": "Z",
  };
  const match = known[normalized.toLowerCase()];
  if (match) return match;
  return normalized
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function brandTypeValue(
  company: Company,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const raw = company.service_type?.trim();
  if (!raw) return company.industry || t("clients.serviceTypeNotSet");
  const normalized = raw.replace(/\s+/g, "").toUpperCase();
  if (normalized === "B2B" || normalized === "B2C") return normalized;
  return raw;
}

function managerName(
  company: Company,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  return (
    company.owner?.name ||
    company.summary?.assigned_members?.[0]?.name ||
    t("clients.ownerNotAssigned")
  );
}
