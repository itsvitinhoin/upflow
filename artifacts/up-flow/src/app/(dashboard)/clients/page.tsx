"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Box,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  Info,
  MoreHorizontal,
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
import { cn } from "@/lib/utils";

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
          <section className="grid gap-5">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/clients/${company.id}`}
                className="group relative min-w-0 overflow-hidden rounded-2xl border border-blue-500/45 bg-[#07101f]/95 p-4 shadow-[0_0_0_1px_rgba(59,130,246,0.08),0_22px_70px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-blue-400/70 hover:bg-[#091426] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.16),0_26px_82px_rgba(0,0,0,0.36),0_0_52px_rgba(37,99,235,0.16)] sm:p-5 lg:p-6"
              >
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_4%_2%,rgba(37,99,235,0.22),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(14,165,233,0.16),transparent_28%)]" />
                <span className="pointer-events-none absolute right-0 top-6 hidden h-40 w-80 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.24),transparent_60%)] opacity-80 lg:block" />

                <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,450px)] lg:items-center">
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-blue-300/45 bg-gradient-to-br from-blue-600/80 via-indigo-700/70 to-blue-950 text-5xl font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_34px_rgba(37,99,235,0.34)] sm:h-28 sm:w-28">
                      {company.name.trim().charAt(0).toUpperCase() || "C"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <h3 className="truncate text-3xl font-bold text-white">
                          {company.name}
                        </h3>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-blue-100/70 ring-1 ring-white/10">
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      </div>
                      <p className="mt-2 truncate text-base text-blue-100/62">
                        {company.industry || company.commercial_status || company.status}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {company.summary?.risk_reasons.length ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/55 bg-rose-500/12 px-3 py-1 text-sm font-semibold text-rose-300">
                            <AlertCircle className="h-4 w-4" />
                            {healthLabel(company.summary?.health_status, t)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-500/12 px-3 py-1 text-sm font-semibold text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" />
                            {healthLabel(company.summary?.health_status, t)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/12 px-3 py-1 text-sm font-semibold text-emerald-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          {company.commercial_status || company.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-primary ring-1 ring-blue-300/10">
                        <Box className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-white">
                          {company.plan_name || t("clients.planNotSet")}
                        </p>
                        <p className="mt-1 truncate text-sm text-blue-100/60">
                          {company.service_type || t("clients.serviceTypeNotSet")}
                          {company.billing_cycle ? ` - ${formatBillingCycle(company.billing_cycle)}` : ""}
                        </p>
                      </div>
                    </div>
                    {company.included_services?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {company.included_services.slice(0, 4).map((service) => (
                          <span
                            key={service}
                            className="max-w-full truncate rounded-xl bg-blue-500/14 px-3 py-1 text-sm font-medium text-blue-300"
                          >
                            {service}
                          </span>
                        ))}
                        {company.included_services.length > 4 ? (
                          <span className="rounded-xl bg-white/7 px-3 py-1 text-sm text-blue-100/55">
                            +{company.included_services.length - 4}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-blue-100/55">{t("clients.noIncludedServices")}</p>
                    )}
                  </div>
                </div>

                <div className="relative mt-5 rounded-2xl border border-white/10 bg-black/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <MetricTile icon={<BriefcaseBusiness className="h-5 w-5" />} label={t("clients.activeProjects")} value={company.summary?.active_project_count ?? company.summary?.project_count ?? 0} />
                    <MetricTile icon={<Clock3 className="h-5 w-5" />} label={t("clients.open")} value={company.summary?.open_task_count ?? 0} />
                    <MetricTile icon={<PackageCheck className="h-5 w-5" />} label={t("clients.contract")} value={money(company.contract_value, language, t)} />
                    <MetricTile icon={<Timer className="h-5 w-5" />} label={t("clients.linkedTime")} value={formatSeconds(company.summary?.tracked_seconds ?? 0)} />
                    <MetricTile
                      icon={<DollarSign className="h-5 w-5" />}
                      label={t("clients.valuePerHour")}
                      value={
                        company.summary?.contract_value_per_tracked_hour != null
                          ? money(company.summary.contract_value_per_tracked_hour, language, t)
                          : t("clients.noTimeValue")
                      }
                    />
                  </div>
                </div>

                <div className="relative mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <DetailChip icon={<Users className="h-4 w-4" />}>
                      {t("clients.contacts", { count: company.summary?.contact_count ?? 0 })}
                    </DetailChip>
                    <DetailChip icon={<Calendar className="h-4 w-4" />}>
                      {t("clients.meetings", { count: company.summary?.meeting_count ?? 0 })}
                    </DetailChip>
                    <DetailChip icon={<DollarSign className="h-4 w-4" />}>
                      {t("clients.commission", { value: money(company.commission, language, t) })}
                    </DetailChip>
                    <DetailChip icon={<Timer className="h-4 w-4" />}>
                      {t("clients.tracked", { value: formatSeconds(company.summary?.tracked_seconds ?? 0) })}
                    </DetailChip>
                    <DetailChip icon={<Users className="h-4 w-4" />}>
                      {t("clients.owner", { name: company.owner?.name || t("clients.ownerNotAssigned") })}
                    </DetailChip>
                    <DetailChip icon={<Calendar className="h-4 w-4" />}>
                      {deadlineLabel(company.summary?.next_deadline, t)}
                    </DetailChip>
                    <DetailChip icon={<Info className="h-4 w-4" />} className="sm:col-span-2">
                      {activityLabel(company.summary?.latest_activity, t)}
                    </DetailChip>
                  </div>
                </div>

                <div className="relative mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-100/55">{t("clients.assignedTeam")}</p>
                  {company.summary?.assigned_members?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {company.summary.assigned_members.slice(0, 4).map((member) => (
                        <AssignedMember key={member.id} name={member.name} />
                      ))}
                      {company.summary.assigned_members.length > 4 ? (
                        <span className="inline-flex items-center rounded-full bg-white/[0.06] px-3 py-2 text-sm text-blue-100/60">
                          +{company.summary.assigned_members.length - 4}
                        </span>
                      ) : null}
                    </div>
                  ) : company.owner?.name ? (
                    <div className="mt-3">
                      <AssignedMember name={company.owner.name} />
                    </div>
                  ) : (
                    <p className="mt-2 flex items-center gap-2 text-sm text-blue-100/55">
                      <AlertCircle className="h-4 w-4" />
                      {t("clients.noAssignedTeam")}
                    </p>
                  )}
                </div>

                {company.summary?.risk_reasons.length ? (
                  <div className="relative mt-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/12 px-4 py-4 text-rose-300">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-300/60">
                        <AlertCircle className="h-5 w-5" />
                      </span>
                      <span className="truncate text-sm font-semibold">
                        {company.summary.risk_reasons.slice(0, 2).join(" - ")}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-rose-200/75 transition group-hover:translate-x-0.5" />
                  </div>
                ) : (
                  <div className="relative mt-4 flex items-center gap-3 rounded-2xl border border-emerald-400/18 bg-emerald-500/10 px-4 py-4 text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-semibold">{t("clients.noTraceableIssues")}</span>
                  </div>
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

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 border-white/10 px-2 py-2 sm:border-r last:border-r-0">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300 ring-1 ring-blue-300/10">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-blue-100/62">{label}</p>
          <p className="mt-2 truncate text-xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DetailChip({
  icon,
  children,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-3 rounded-xl border border-white/7 bg-white/[0.045] px-4 py-3 text-sm text-blue-100/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]", className)}>
      <span className="shrink-0 text-blue-100/65">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function AssignedMember({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-3 rounded-full bg-white/[0.055] py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white ring-1 ring-white/7">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-rose-300 to-sky-300 text-sm font-bold text-slate-950">
        {name.trim().charAt(0).toUpperCase() || "U"}
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111827] bg-emerald-400" />
      </span>
      <span className="max-w-[12rem] truncate">{name}</span>
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

function activityLabel(
  activity: NonNullable<Company["summary"]>["latest_activity"] | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (!activity) return t("clients.noActivity");
  const label = activity.type.replaceAll("_", " ");
  return `${label} - ${shortDate(activity.created_at)}`;
}
