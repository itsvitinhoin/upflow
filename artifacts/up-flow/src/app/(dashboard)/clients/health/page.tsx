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

export default function ClientHealthPage() {
  const { language } = useLanguage();
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
      if (!res.ok) throw new Error(data.error || `Could not load clients (${res.status})`);
      setCompanies(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load client health");
    } finally {
      setLoading(false);
    }
  }, []);

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
      <Header title="Client Health" />
      <main className="mx-auto w-full max-w-[1500px] space-y-5 overflow-x-hidden p-4 sm:p-6">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-lg dark:border-blue-300/[0.15] dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(15,23,42,0.94))] dark:shadow-[0_0_40px_rgba(37,99,235,0.12)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/[0.15] text-blue-700 ring-1 ring-blue-400/30 dark:text-blue-100 dark:ring-blue-300/20">
                <HeartPulse className="h-5 w-5" />
              </div>
              <h1 className="mt-4 text-3xl font-bold text-foreground">Client Health Center</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Daily leadership view for client risk, missing setup, stale activity, overdue work, next deadlines, owners, tracked time, and value per hour.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/clients"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent dark:border-white/10 dark:bg-white/[0.15] dark:hover:bg-white/[0.15]"
              >
                <Building2 className="h-4 w-4" />
                Client cards
              </Link>
              <button
                type="button"
                onClick={loadCompanies}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <HealthStat label="At risk" value={counts.risk} tone="danger" icon={<AlertCircle className="h-4 w-4" />} />
          <HealthStat label="Needs attention" value={counts.attention} tone="warning" icon={<HeartPulse className="h-4 w-4" />} />
          <HealthStat label="Healthy" value={counts.healthy} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
          <HealthStat label="Missing setup" value={missingSetup.length} tone="info" icon={<Filter className="h-4 w-4" />} />
          <HealthStat label="Tracked clients" value={companies.length} tone="neutral" icon={<BarChart3 className="h-4 w-4" />} />
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
                    placeholder="Search clients, owners, plans, services..."
                    className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-white/[0.15]"
                  />
                </label>
                <SelectBox
                  icon={<Filter className="h-4 w-4" />}
                  value={filter}
                  onChange={(value) => setFilter(value as HealthFilter)}
                  options={[
                    ["needs_attention", "Needs attention"],
                    ["risk", "At risk"],
                    ["missing_setup", "Missing setup"],
                    ["no_activity", "No activity"],
                    ["overdue", "Overdue"],
                    ["all", "All clients"],
                  ]}
                />
                <SelectBox
                  icon={<ArrowUpDown className="h-4 w-4" />}
                  value={sort}
                  onChange={(value) => setSort(value as ClientHealthSort)}
                  options={[
                    ["risk", "Risk score"],
                    ["deadline", "Next deadline"],
                    ["value_per_hour", "Lowest value/hour"],
                    ["tracked_time", "Tracked time"],
                    ["name", "Name"],
                  ]}
                />
                <div className="inline-flex h-10 rounded-xl border border-border bg-muted/30 p-1 dark:border-white/10 dark:bg-white/[0.15]">
                  <ViewButton active={view === "table"} onClick={() => setView("table")} icon={<List className="h-4 w-4" />} label="Table" />
                  <ViewButton active={view === "cards"} onClick={() => setView("cards")} icon={<LayoutGrid className="h-4 w-4" />} label="Cards" />
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
                <p className="text-sm font-semibold text-foreground">Could not load Client Health Center</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </section>
            ) : filtered.length === 0 ? (
              <section className="rounded-2xl border border-border bg-card p-8 text-center dark:border-white/10 dark:bg-card/70">
                <CheckCircle2 className="mx-auto h-9 w-9 text-upflow-success" />
                <h2 className="mt-3 text-base font-semibold text-foreground">No matching client risks</h2>
                <p className="mt-1 text-sm text-muted-foreground">Try another filter or search term.</p>
              </section>
            ) : view === "table" ? (
              <ClientHealthTable items={filtered} language={language} />
            ) : (
              <section className="grid gap-3 xl:grid-cols-2">
                {filtered.map((item) => (
                  <ClientHealthCard key={item.company.id} item={item} language={language} />
                ))}
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Needs attention queue</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Top clients by risk score.</p>
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
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.primaryReason}</span>
                    </span>
                    <span className="rounded-full bg-rose-500/[0.15] px-2 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">{item.score}</span>
                  </Link>
                ))}
                {needsAttention.length === 0 ? (
                  <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-black/10">
                    No clients currently need attention.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card/70">
              <h2 className="text-sm font-semibold text-foreground">Health rules</h2>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                {[
                  "Overdue open tasks",
                  "No activity in 7 days",
                  "Missing contacts",
                  "Missing contract value",
                  "Missing service plan",
                  "No linked projects",
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

function ClientHealthTable({ items, language }: { items: RankedClientHealth[]; language: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card dark:border-white/10 dark:bg-card/70">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-[0.14em] text-muted-foreground dark:border-white/10">
            <tr>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Risk</th>
              <th className="px-4 py-3 font-semibold">Signals</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Next deadline</th>
              <th className="px-4 py-3 font-semibold">Tracked</th>
              <th className="px-4 py-3 font-semibold">Value/hour</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.company.id} className="border-b border-border/60 last:border-0 dark:border-white/5">
                <td className="px-4 py-4">
                  <p className="font-semibold text-foreground">{item.company.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.company.plan_name || item.company.service_type || "Plan not set"}</p>
                </td>
                <td className="px-4 py-4">
                  <HealthPill bucket={item.bucket} score={item.score} />
                </td>
                <td className="px-4 py-4">
                  <SignalList item={item} />
                </td>
                <td className="px-4 py-4 text-muted-foreground">{item.company.owner?.name || "Owner not assigned"}</td>
                <td className="px-4 py-4 text-muted-foreground">{deadlineLabel(item.company.summary?.next_deadline)}</td>
                <td className="px-4 py-4 font-mono text-foreground">{formatSeconds(item.company.summary?.tracked_seconds ?? 0)}</td>
                <td className="px-4 py-4 font-semibold text-foreground">{money(item.company.summary?.contract_value_per_tracked_hour, language)}</td>
                <td className="px-4 py-4">
                  <Link href={`/clients/${item.company.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent dark:border-white/10 dark:bg-white/[0.15] dark:hover:bg-white/[0.15]">
                    <Eye className="h-3.5 w-3.5" />
                    Open
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

function ClientHealthCard({ item, language }: { item: RankedClientHealth; language: string }) {
  const company = item.company;
  return (
    <Link href={`/clients/${company.id}`} className="group rounded-2xl border border-border bg-card p-4 transition hover:border-blue-400/[0.35] hover:bg-accent dark:border-blue-500/25 dark:bg-[#07101f]/95 dark:hover:bg-[#091426]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-foreground dark:text-white">{company.name}</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground dark:text-blue-100/[0.55]">{company.plan_name || company.service_type || "Plan not set"}</p>
        </div>
        <HealthPill bucket={item.bucket} score={item.score} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{item.primaryReason}</p>
      <SignalList item={item} className="mt-3" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniMetric icon={<Users className="h-4 w-4" />} label="Owner" value={company.owner?.name || "Not assigned"} />
        <MiniMetric icon={<Clock3 className="h-4 w-4" />} label="Deadline" value={deadlineLabel(company.summary?.next_deadline)} />
        <MiniMetric icon={<Timer className="h-4 w-4" />} label="Tracked" value={formatSeconds(company.summary?.tracked_seconds ?? 0)} />
        <MiniMetric icon={<DollarSign className="h-4 w-4" />} label="Value/hour" value={money(company.summary?.contract_value_per_tracked_hour, language)} />
      </div>
    </Link>
  );
}

function SignalList({ item, className }: { item: RankedClientHealth; className?: string }) {
  const active = clientHealthSignals(item.company).filter((signal) => signal.active);
  return (
    <div className={cn("flex max-w-xl flex-wrap gap-1.5", className)}>
      {active.length ? (
        active.slice(0, 4).map((signal) => (
          <span key={signal.key} className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700 dark:text-rose-300">
            {signal.label}
          </span>
        ))
      ) : (
        <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          No traceable issues
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

function HealthPill({ bucket, score }: { bucket: ClientHealthBucket; score: number }) {
  const label = {
    risk: "At risk",
    attention: "Attention",
    healthy: "Healthy",
    not_enough_data: "Needs data",
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

function deadlineLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  return formatDate(value);
}

function formatSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function money(value: number | null | undefined, language: string) {
  if (value == null) return "No value";
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: language === "pt-BR" ? "BRL" : "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
