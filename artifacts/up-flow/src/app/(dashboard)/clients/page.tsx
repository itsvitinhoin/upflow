"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  History,
  PackageCheck,
  Plus,
  RefreshCcw,
  Timer,
  Users,
} from "lucide-react";
import Header from "@/components/layout/header";
import CreateCompanyDialog from "@/components/dashboard/create-company-dialog";
import { useLanguage } from "@/components/language-provider";
import type { Company } from "@/lib/types";

type ClientHealthStatus = "healthy" | "attention" | "risk" | "not_enough_data" | null | undefined;

export default function ClientsPage() {
  const { language, t } = useLanguage();
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
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t("clients.newCompany")}
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
              {t("clients.newCompany")}
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
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${healthClass(company.summary?.health_status)}`}>
                    {healthLabel(company.summary?.health_status, t)}
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {company.commercial_status || company.status}
                  </span>
                </div>

                <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-start gap-2">
                    <PackageCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {company.plan_name || t("clients.planNotSet")}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {company.service_type || t("clients.serviceTypeNotSet")}
                        {company.billing_cycle ? ` - ${formatBillingCycle(company.billing_cycle)}` : ""}
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
                    <p className="mt-3 text-xs text-muted-foreground">{t("clients.noIncludedServices")}</p>
                  )}
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <MetricPill label={t("clients.activeProjects")} value={company.summary?.active_project_count ?? company.summary?.project_count ?? 0} />
                  <MetricPill label={t("clients.open")} value={company.summary?.open_task_count ?? 0} />
                  <MetricPill label={t("clients.contract")} value={money(company.contract_value, language, t)} />
                </div>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  <MetricPill label={t("clients.linkedTime")} value={formatSeconds(company.summary?.tracked_seconds ?? 0)} />
                  <MetricPill
                    label={t("clients.valuePerHour")}
                    value={
                      company.summary?.contract_value_per_tracked_hour != null
                        ? money(company.summary.contract_value_per_tracked_hour, language, t)
                        : t("clients.noTimeValue")
                    }
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <Users className="h-3.5 w-3.5" />
                    {t("clients.contacts", { count: company.summary?.contact_count ?? 0 })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("clients.meetings", { count: company.summary?.meeting_count ?? 0 })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    {t("clients.commission", { value: money(company.commission, language, t) })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <Timer className="h-3.5 w-3.5" />
                    {t("clients.tracked", { value: formatSeconds(company.summary?.tracked_seconds ?? 0) })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <Users className="h-3.5 w-3.5" />
                    {t("clients.owner", { name: company.owner?.name || t("clients.ownerNotAssigned") })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {deadlineLabel(company.summary?.next_deadline, t)}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                    <History className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{activityLabel(company.summary?.latest_activity, t)}</span>
                  </span>
                </div>
                <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{t("clients.assignedTeam")}</p>
                  {company.summary?.assigned_members?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {company.summary.assigned_members.slice(0, 4).map((member) => (
                        <span key={member.id} className="max-w-full truncate rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-foreground">
                          {member.name}
                        </span>
                      ))}
                      {company.summary.assigned_members.length > 4 ? (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
                          +{company.summary.assigned_members.length - 4}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {t("clients.noAssignedTeam")}
                    </p>
                  )}
                </div>

                {company.summary?.risk_reasons.length ? (
                  <p className="mt-3 flex items-center gap-1 text-xs text-upflow-danger">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {company.summary.risk_reasons.slice(0, 2).join(" - ")}
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-upflow-success" />
                    {t("clients.noTraceableIssues")}
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
          {t("common.refresh")}
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

function money(value: number | null | undefined, language: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (value == null) return t("clients.noValue");
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: language === "pt-BR" ? "BRL" : "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function deadlineLabel(
  value: string | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (!value) return t("clients.nextDeadlineNotSet");
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today
    ? t("clients.overdueSince", { date: shortDate(value) })
    : t("clients.nextDeadline", { date: shortDate(value) });
}

function formatSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function healthLabel(
  status: ClientHealthStatus,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (status === "healthy") return t("clients.health.healthy");
  if (status === "attention") return t("clients.health.attention");
  if (status === "risk") return t("clients.health.risk");
  return t("clients.health.notEnough");
}

function healthClass(status: ClientHealthStatus) {
  if (status === "healthy") return "bg-upflow-success/15 text-upflow-success";
  if (status === "attention") return "bg-upflow-warning/15 text-upflow-warning";
  if (status === "risk") return "bg-upflow-danger/15 text-upflow-danger";
  return "bg-white/5 text-muted-foreground";
}

function activityLabel(
  activity: NonNullable<Company["summary"]>["latest_activity"] | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (!activity) return t("clients.noActivity");
  const label = activity.type.replaceAll("_", " ");
  return `${label} - ${shortDate(activity.created_at)}`;
}

