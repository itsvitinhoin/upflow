"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  DollarSign,
  Eye,
  Filter,
  HeartPulse,
  LayoutGrid,
  List,
  RefreshCcw,
  Search,
  Timer,
  Users,
} from "lucide-react";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";
import {
  clientHealthSignals,
  rankClientHealth,
  type ClientHealthBucket,
  type ClientHealthSignal,
  type ClientHealthSort,
  type RankedClientHealth,
} from "@/lib/client-health";
import type { Company } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type HealthFilter =
  | "all"
  | "needs_attention"
  | "risk"
  | "missing_setup"
  | "no_activity"
  | "overdue";

type ViewMode = "table" | "cards";
type Translate = (key: string, vars?: Record<string, string | number>) => string;

export default function ClientHealthPage() {
  const { language, t } = useLanguage();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<HealthFilter>("needs_attention");
  const [sort, setSort] = useState<ClientHealthSort>("risk");
  const [view, setView] = useState<ViewMode>("table");

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/companies?limit=100", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { items?: Company[]; error?: string };
      if (!res.ok) throw new Error(data.error || t("clientHealth.couldNotLoadWithStatus", { status: res.status }));
      setCompanies(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clientHealth.couldNotLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const ranked = useMemo(() => rankClientHealth(companies, sort), [companies, sort]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ranked.filter((item) => {
      const company = item.company;
      const signals = item.signals;
      const matchesQuery =
        !normalized ||
        company.name.toLowerCase().includes(normalized) ||
        company.owner?.name.toLowerCase().includes(normalized) ||
        company.plan_name?.toLowerCase().includes(normalized) ||
        company.service_type?.toLowerCase().includes(normalized);
      if (!matchesQuery) return false;
      if (filter === "all") return true;
      if (filter === "needs_attention") return item.bucket === "risk" || item.bucket === "attention";
      if (filter === "risk") return item.bucket === "risk";
      if (filter === "missing_setup") {
        return signals.some(
          (signal) =>
            signal.active &&
            (signal.key === "missing_contacts" ||
              signal.key === "missing_contract_value" ||
              signal.key === "missing_service_plan" ||
              signal.key === "no_linked_projects"),
        );
      }
      if (filter === "no_activity") return signals.some((signal) => signal.active && signal.key === "no_activity");
      if (filter === "overdue") return signals.some((signal) => signal.active && signal.key === "overdue_tasks");
      return true;
    });
  }, [filter, query, ranked]);

  const counts = useMemo(() => {
    const initial: Record<ClientHealthBucket, number> = {
      risk: 0,
      attention: 0,
      healthy: 0,
      not_enough_data: 0,
    };
    for (const item of ranked) initial[item.bucket] += 1;
    return initial;
  }, [ranked]);
  const needsAttention = ranked.filter((item) => item.bucket === "risk" || item.bucket === "attention");
  const missingSetup = ranked.filter((item) =>
    item.signals.some(
      (signal) =>
        signal.active &&
        (signal.key === "missing_contacts" ||
          signal.key === "missing_contract_value" ||
          signal.key === "missing_service_plan" ||
          signal.key === "no_linked_projects"),
    ),
  );

  return (
    <>
      <Header title={t("clientHealth.title")} />
      <main className="mx-auto w-full max-w-[1500px] space-y-5 overflow-x-hidden p-4 sm:p-6">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-lg dark:border-blue-300/[0.15] dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(15,23,42,0.94))] dark:shadow-[0_0_40px_rgba(37,99,235,0.12)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/[0.15] text-blue-700 ring-1 ring-blue-400/30 dark:text-blue-100 dark:ring-blue-300/20">
                <HeartPulse className="h-5 w-5" />
              </div>
              <h1 className="mt-4 text-3xl font-bold text-foreground">{t("clientHealth.heading")}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {t("clientHealth.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/clients"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent dark:border-white/10 dark:bg-white/[0.15] dark:hover:bg-white/[0.15]"
              >
                <Building2 className="h-4 w-4" />
                {t("clientHealth.clientCards")}
              </Link>
              <button
                type="button"
                onClick={loadCompanies}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCcw className="h-4 w-4" />
                {t("common.refresh")}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <HealthStat label={t("clientHealth.atRisk")} value={counts.risk} tone="danger" icon={<AlertCircle className="h-4 w-4" />} />
          <HealthStat label={t("clientHealth.needsAttention")} value={counts.attention} tone="warning" icon={<HeartPulse className="h-4 w-4" />} />
          <HealthStat label={t("clientHealth.healthy")} value={counts.healthy} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
          <HealthStat label={t("clientHealth.missingSetup")} value={missingSetup.length} tone="info" icon={<Filter className="h-4 w-4" />} />
          <HealthStat label={t("clientHealth.trackedClients")} value={companies.length} tone="neutral" icon={<BarChart3 className="h-4 w-4" />} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card/70">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
                <label className="relative block min-w-0">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("clientHealth.searchPlaceholder")}
                    className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-white/[0.15]"
                  />
                </label>
                <SelectBox
                  icon={<Filter className="h-4 w-4" />}
                  value={filter}
                  onChange={(value) => setFilter(value as HealthFilter)}
                  options={[
                    ["needs_attention", t("clientHealth.needsAttention")],
                    ["risk", t("clientHealth.atRisk")],
                    ["missing_setup", t("clientHealth.missingSetup")],
                    ["no_activity", t("clientHealth.noActivity")],
                    ["overdue", t("clientHealth.overdue")],
                    ["all", t("clientHealth.allClients")],
                  ]}
                />
                <SelectBox
                  icon={<ArrowUpDown className="h-4 w-4" />}
                  value={sort}
                  onChange={(value) => setSort(value as ClientHealthSort)}
                  options={[
                    ["risk", t("clientHealth.riskScore")],
                    ["deadline", t("clientHealth.nextDeadline")],
                    ["value_per_hour", t("clientHealth.lowestValuePerHour")],
                    ["tracked_time", t("clientHealth.trackedTime")],
                    ["name", t("clientHealth.name")],
                  ]}
                />
                <div className="inline-flex h-10 rounded-xl border border-border bg-muted/30 p-1 dark:border-white/10 dark:bg-white/[0.15]">
                  <ViewButton active={view === "table"} onClick={() => setView("table")} icon={<List className="h-4 w-4" />} label={t("clientHealth.table")} />
                  <ViewButton active={view === "cards"} onClick={() => setView("cards")} icon={<LayoutGrid className="h-4 w-4" />} label={t("clientHealth.cards")} />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="grid gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-2xl bg-muted dark:bg-white/5" />
                ))}
              </div>
            ) : error ? (
              <section className="rounded-2xl border border-upflow-danger/30 bg-upflow-danger/10 p-5">
                <p className="text-sm font-semibold text-foreground">{t("clientHealth.loadFailedHeading")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </section>
            ) : filtered.length === 0 ? (
              <section className="rounded-2xl border border-border bg-card p-8 text-center dark:border-white/10 dark:bg-card/70">
                <CheckCircle2 className="mx-auto h-9 w-9 text-upflow-success" />
                <h2 className="mt-3 text-base font-semibold text-foreground">{t("clientHealth.noMatchingRisks")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("clientHealth.tryAnotherFilter")}</p>
              </section>
            ) : view === "table" ? (
              <ClientHealthTable items={filtered} language={language} t={t} />
            ) : (
              <section className="grid gap-3 xl:grid-cols-2">
                {filtered.map((item) => (
                  <ClientHealthCard key={item.company.id} item={item} language={language} t={t} />
                ))}
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{t("clientHealth.attentionQueue")}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{t("clientHealth.topByRisk")}</p>
                </div>
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-300" />
              </div>
              <div className="mt-4 space-y-2">
                {needsAttention.slice(0, 8).map((item, index) => (
                  <Link
                    key={item.company.id}
                    href={`/clients/${item.company.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-accent dark:border-white/10 dark:bg-black/10 dark:hover:bg-white/[0.15]"
                  >
                    <span className="min-w-0">
                      <span className="mr-2 text-xs font-semibold text-muted-foreground">{index + 1}</span>
                      <span className="font-medium text-foreground">{item.company.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{primaryReason(item, t)}</span>
                    </span>
                    <span className="rounded-full bg-rose-500/[0.15] px-2 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">{item.score}</span>
                  </Link>
                ))}
                {needsAttention.length === 0 ? (
                  <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-black/10">
                    {t("clientHealth.noClientsNeedAttention")}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card/70">
              <h2 className="text-sm font-semibold text-foreground">{t("clientHealth.healthRules")}</h2>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {[
                  t("clientHealth.overdueTasks"),
                  t("clientHealth.noActivitySevenDays"),
                  t("clientHealth.missingContacts"),
                  t("clientHealth.missingContractValue"),
                  t("clientHealth.missingServicePlan"),
                  t("clientHealth.noLinkedProjects"),
                ].map((rule) => (
                  <div key={rule} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-300" />
                    {rule}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </>
  );
}

function ClientHealthTable({ items, language, t }: { items: RankedClientHealth[]; language: string; t: Translate }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card dark:border-white/10 dark:bg-card/70">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-[0.14em] text-muted-foreground dark:border-white/10">
            <tr>
              <th className="px-4 py-3 font-semibold">{t("clientHealth.client")}</th>
              <th className="px-4 py-3 font-semibold">{t("clientHealth.risk")}</th>
              <th className="px-4 py-3 font-semibold">{t("clientHealth.signals")}</th>
              <th className="px-4 py-3 font-semibold">{t("clientHealth.owner")}</th>
              <th className="px-4 py-3 font-semibold">{t("clientHealth.nextDeadline")}</th>
              <th className="px-4 py-3 font-semibold">{t("clientHealth.tracked")}</th>
              <th className="px-4 py-3 font-semibold">{t("clientHealth.valuePerHour")}</th>
              <th className="px-4 py-3 font-semibold">{t("clientHealth.action")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.company.id} className="border-b border-border/60 last:border-0 dark:border-white/5">
                <td className="px-4 py-4">
                  <p className="font-semibold text-foreground">{item.company.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.company.plan_name || item.company.service_type || t("clientHealth.planNotSet")}</p>
                </td>
                <td className="px-4 py-4">
                  <HealthPill bucket={item.bucket} score={item.score} t={t} />
                </td>
                <td className="px-4 py-4">
                  <SignalList item={item} t={t} />
                </td>
                <td className="px-4 py-4 text-muted-foreground">{item.company.owner?.name || t("clientHealth.ownerNotAssigned")}</td>
                <td className="px-4 py-4 text-muted-foreground">{deadlineLabel(item.company.summary?.next_deadline, t, language)}</td>
                <td className="px-4 py-4 font-mono text-foreground">{formatSeconds(item.company.summary?.tracked_seconds ?? 0, t)}</td>
                <td className="px-4 py-4 font-semibold text-foreground">{money(item.company.summary?.contract_value_per_tracked_hour, language, t)}</td>
                <td className="px-4 py-4">
                  <Link href={`/clients/${item.company.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent dark:border-white/10 dark:bg-white/[0.15] dark:hover:bg-white/[0.15]">
                    <Eye className="h-3.5 w-3.5" />
                    {t("clientHealth.open")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClientHealthCard({ item, language, t }: { item: RankedClientHealth; language: string; t: Translate }) {
  const company = item.company;
  return (
    <Link href={`/clients/${company.id}`} className="group rounded-2xl border border-border bg-card p-4 transition hover:border-blue-400/[0.35] hover:bg-accent dark:border-blue-500/25 dark:bg-[#07101f]/95 dark:hover:bg-[#091426]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-foreground dark:text-white">{company.name}</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground dark:text-blue-100/[0.55]">{company.plan_name || company.service_type || t("clientHealth.planNotSet")}</p>
        </div>
        <HealthPill bucket={item.bucket} score={item.score} t={t} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{primaryReason(item, t)}</p>
      <SignalList item={item} t={t} className="mt-3" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniMetric icon={<Users className="h-4 w-4" />} label={t("clientHealth.owner")} value={company.owner?.name || t("clientHealth.notAssigned")} />
        <MiniMetric icon={<Clock3 className="h-4 w-4" />} label={t("clientHealth.deadline")} value={deadlineLabel(company.summary?.next_deadline, t, language)} />
        <MiniMetric icon={<Timer className="h-4 w-4" />} label={t("clientHealth.tracked")} value={formatSeconds(company.summary?.tracked_seconds ?? 0, t)} />
        <MiniMetric icon={<DollarSign className="h-4 w-4" />} label={t("clientHealth.valuePerHour")} value={money(company.summary?.contract_value_per_tracked_hour, language, t)} />
      </div>
    </Link>
  );
}

function SignalList({ item, t, className }: { item: RankedClientHealth; t: Translate; className?: string }) {
  const active = clientHealthSignals(item.company).filter((signal) => signal.active);
  return (
    <div className={cn("flex max-w-xl flex-wrap gap-1.5", className)}>
      {active.length ? (
        active.slice(0, 4).map((signal) => (
          <span key={signal.key} className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700 dark:text-rose-300">
            {signalLabel(signal.key, t)}
          </span>
        ))
      ) : (
        <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {t("clientHealth.noTraceableIssues")}
        </span>
      )}
    </div>
  );
}

function HealthStat({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: "danger" | "warning" | "success" | "info" | "neutral" }) {
  const toneClass = {
    danger: "border-rose-400/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    warning: "border-amber-400/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    info: "border-sky-400/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    neutral: "border-border bg-muted/30 text-muted-foreground dark:border-white/10 dark:bg-white/[0.15] dark:text-blue-100",
  }[tone];
  return (
    <article className={cn("rounded-2xl border p-4", toneClass)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
    </article>
  );
}

function HealthPill({ bucket, score, t }: { bucket: ClientHealthBucket; score: number; t: Translate }) {
  const label = {
    risk: t("clientHealth.atRisk"),
    attention: t("clientHealth.attention"),
    healthy: t("clientHealth.healthy"),
    not_enough_data: t("clientHealth.needsData"),
  }[bucket];
  const klass = {
    risk: "border-rose-400/30 bg-rose-500/[0.15] text-rose-700 dark:text-rose-300",
    attention: "border-amber-400/30 bg-amber-500/[0.15] text-amber-700 dark:text-amber-300",
    healthy: "border-emerald-400/30 bg-emerald-500/[0.15] text-emerald-700 dark:text-emerald-300",
    not_enough_data: "border-slate-400/30 bg-slate-500/[0.15] text-slate-700 dark:text-slate-300",
  }[bucket];
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold", klass)}>
      {label}
      <span className="rounded-full bg-black/[0.15] px-1.5 py-0.5 font-mono dark:bg-black/20">{score}</span>
    </span>
  );
}

function SelectBox({ icon, value, onChange, options }: { icon: ReactNode; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.15]">
      {icon}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent text-foreground outline-none">
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue} className="bg-popover text-popover-foreground">
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ViewButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/30 px-3 py-2 dark:border-white/10 dark:bg-white/[0.15]">
      <div className="flex items-center gap-2 text-muted-foreground dark:text-blue-100/[0.55]">
        {icon}
        <span className="truncate text-[11px]">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-foreground dark:text-white">{value}</p>
    </div>
  );
}

function signalLabel(key: ClientHealthSignal["key"], t: Translate) {
  const labelKey: Record<ClientHealthSignal["key"], string> = {
    overdue_tasks: "clientHealth.overdueTasks",
    no_activity: "clientHealth.noActivitySevenDays",
    missing_contacts: "clientHealth.missingContacts",
    missing_contract_value: "clientHealth.missingContractValue",
    missing_service_plan: "clientHealth.missingServicePlan",
    no_linked_projects: "clientHealth.noLinkedProjects",
  };
  return t(labelKey[key]);
}

function primaryReason(item: RankedClientHealth, t: Translate) {
  const reason = item.company.summary?.risk_reasons?.[0];
  if (reason) return reason;
  const signal = item.signals.find((candidate) => candidate.active);
  return signal ? signalLabel(signal.key, t) : t("clientHealth.noTraceableIssues");
}

function deadlineLabel(value: string | null | undefined, t: Translate, language: string) {
  if (!value) return t("clientHealth.notSet");
  return formatDate(value, language === "pt-BR" ? "pt-BR" : "en-US");
}

function formatSeconds(totalSeconds: number, t: Translate) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return t("clientHealth.hoursMinutes", { hours, minutes });
  return t("clientHealth.minutes", { minutes });
}

function money(value: number | null | undefined, language: string, t: Translate) {
  if (value == null) return t("clientHealth.noValue");
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: language === "pt-BR" ? "BRL" : "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
