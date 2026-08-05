"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCcw,
  Rocket,
  Search,
  UserRound,
} from "lucide-react";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";
import ClientPinButton from "@/components/clients/client-pin-button";
import { onboardingTitleLabel } from "@/lib/onboarding-labels";
import type { AppUser, ClientOnboarding } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type QueueView = "all" | "mine" | "blocked" | "due_week" | "missing_mapping";
type QueueLifecycle = "active" | "completed";
type OnboardingResponse = { items?: ClientOnboarding[] };
type PinnedClientsResponse = { items?: Array<{ company_id: string }> };
type Translate = (key: string, vars?: Record<string, string | number>) => string;

const VIEWS: Array<{ key: QueueView; labelKey: string }> = [
  { key: "all", labelKey: "onboardingQueue.view.all" },
  { key: "mine", labelKey: "onboardingQueue.view.mine" },
  { key: "blocked", labelKey: "onboardingQueue.view.blocked" },
  { key: "due_week", labelKey: "onboardingQueue.view.dueWeek" },
  { key: "missing_mapping", labelKey: "onboardingQueue.view.missingMapping" },
];

const ONBOARDING_CARD_PAGE_SIZE = 12;

function statusLabel(status: string, t: Translate) {
  const key = `onboardingWorkflow.status.${status}`;
  const translated = t(key);
  return translated === key ? status.replaceAll("_", " ") : translated;
}

function statusClass(status: string) {
  if (status === "onboarding_complete" || status === "complete" || status === "marketing_b2b_ready") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200";
  }
  if (status === "needs_mapping") {
    return "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-200";
  }
  if (status.includes("in_progress")) {
    return "border-blue-400/30 bg-blue-400/10 text-blue-700 dark:text-blue-100";
  }
  return "border-amber-400/25 bg-amber-400/10 text-amber-800 dark:text-amber-100";
}

function missingMappings(item: ClientOnboarding) {
  return (item.service_assignments ?? []).filter(
    (assignment) => assignment.status === "needs_mapping" || !assignment.leader_id,
  );
}

function usesUpZero(item: ClientOnboarding) {
  return (item.contracted_services ?? []).some(
    (service) => service.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ") === "up zero",
  );
}

function isMarketingB2COnboarding(item: ClientOnboarding) {
  return (item.marketing_b2c_forms ?? []).length > 0 || (item.checklist_items ?? []).some((check) => {
    const details = `${check.department} ${check.title}`.toLowerCase();
    return details.includes("marketing b2c") || details.includes("b2c");
  });
}

function upZeroTechnicalItem(item: ClientOnboarding) {
  return item.checklist_items?.find(
    (check) => check.automation_key === "up_zero_website_configuration",
  ) ?? null;
}

function marketingB2BBlockedByUpZero(item: ClientOnboarding) {
  return (
    usesUpZero(item) &&
    !isMarketingB2COnboarding(item) &&
    !item.up_zero_configuration_completed_at &&
    !item.marketing_b2b_released_at &&
    !item.marketing_b2b_dependency_overridden_at
  );
}

function blockers(item: ClientOnboarding, t: Translate) {
  const results: string[] = [];
  if (marketingB2BBlockedByUpZero(item)) {
    results.push(t("onboardingBoard.blocker.upZero"));
  }
  if ((item.checklist_items ?? []).some((check) => check.department === "Finance" && check.status !== "complete")) {
    results.push(t("onboardingBoard.blocker.finance"));
  }
  if ((item.contracts ?? []).length === 0) {
    results.push(t("onboardingBoard.blocker.contract"));
  }
  if (missingMappings(item).length > 0) {
    results.push(t("onboardingBoard.blocker.owners"));
  }
  if (!item.support_group?.group_created) {
    results.push(t("onboardingBoard.blocker.group"));
  }
  if ((item.meetings ?? []).some((meeting) => !meeting.scheduled)) {
    results.push(t("onboardingBoard.blocker.meeting"));
  }
  return results;
}

function nextAction(item: ClientOnboarding) {
  if (marketingB2BBlockedByUpZero(item)) return upZeroTechnicalItem(item);
  return item.checklist_items?.find((check) => check.status !== "complete") ?? null;
}

function dueThisWeek(item: ClientOnboarding) {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);
  const dueDates = [
    item.expected_start_date,
    ...(item.checklist_items ?? []).map((check) => check.due_date),
  ].filter(Boolean) as string[];

  return dueDates.some((value) => {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= now && date <= weekEnd;
  });
}

function belongsToMe(item: ClientOnboarding, userId: string | null) {
  if (!userId) return false;
  if (item.responsible_salesperson_id === userId) return true;
  if ((item.checklist_items ?? []).some((check) => check.owner_id === userId)) return true;
  return (item.service_assignments ?? []).some((assignment) => assignment.leader_id === userId);
}

export default function OnboardingQueuePage() {
  const { language, t } = useLanguage();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const [items, setItems] = useState<ClientOnboarding[]>([]);
  const [user, setUser] = useState<AppUser | null>(null);
  const [view, setView] = useState<QueueView>("all");
  const [lifecycle, setLifecycle] = useState<QueueLifecycle>("active");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [pinnedCompanyIds, setPinnedCompanyIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(ONBOARDING_CARD_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ lifecycle });
      if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
      const [onboardingRes, meRes, pinsRes] = await Promise.all([
        fetch(`/api/onboarding?${params.toString()}`),
        fetch("/api/auth/me"),
        fetch("/api/sidebar-pins"),
      ]);
      if (!onboardingRes.ok) throw new Error(t("onboardingQueue.loadFailed"));
      const payload = (await onboardingRes.json()) as OnboardingResponse;
      setItems(payload.items ?? []);
      if (meRes.ok) setUser((await meRes.json()) as AppUser);
      if (pinsRes.ok) {
        const pins = (await pinsRes.json()) as PinnedClientsResponse;
        setPinnedCompanyIds(new Set((pins.items ?? []).map((pin) => pin.company_id)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboardingQueue.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [deferredQuery, lifecycle, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePinnedChange = (companyId: string, pinned: boolean) => {
    setPinnedCompanyIds((current) => {
      const next = new Set(current);
      if (pinned) next.add(companyId);
      else next.delete(companyId);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (view === "mine") return items.filter((item) => belongsToMe(item, user?.id ?? null));
    if (view === "blocked") return items.filter((item) => blockers(item, t).length > 0);
    if (view === "due_week") return items.filter(dueThisWeek);
    if (view === "missing_mapping") return items.filter((item) => missingMappings(item).length > 0);
    return items;
  }, [items, t, user?.id, view]);

  useEffect(() => {
    setVisibleCount(ONBOARDING_CARD_PAGE_SIZE);
  }, [deferredQuery, lifecycle, view]);

  const visibleItems = filtered.slice(0, visibleCount);

  return (
    <>
      <Header title={t("onboardingQueue.title")} />
      <main className="onboarding-queue-shell min-h-screen space-y-5 bg-background p-4 text-foreground dark:bg-[#020817] dark:text-slate-100 sm:p-6">
        <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm dark:border-blue-500/25 dark:bg-[#06101f] dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">{t("onboardingQueue.eyebrow")}</p>
              <h2 className="mt-2 text-2xl font-black text-foreground dark:text-white">{t("onboardingQueue.title")}</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground dark:text-slate-400">{t("onboardingQueue.subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-foreground transition hover:border-blue-400/60 hover:bg-accent dark:border-blue-300/20 dark:bg-slate-950/50 dark:text-slate-100"
            >
              <RefreshCcw className="h-4 w-4" /> {t("common.refresh")}
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex w-fit rounded-xl border border-border bg-background p-1 dark:border-slate-800 dark:bg-slate-950/40">
              {(["active", "completed"] as QueueLifecycle[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLifecycle(value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                    lifecycle === value
                      ? "bg-blue-600 text-primary-foreground dark:bg-blue-500/25"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground dark:text-slate-400 dark:hover:text-white",
                  )}
                >
                  {t(`onboardingQueue.lifecycle.${value}`)}
                </button>
              ))}
            </div>
            <label className="relative block w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label={t("onboardingQueue.searchPlaceholder")}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("onboardingQueue.searchPlaceholder")}
                className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/15 dark:border-slate-800 dark:bg-slate-950/40"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {VIEWS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setView(preset.key)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-bold transition",
                  view === preset.key
                    ? "border-blue-500 bg-blue-600 text-primary-foreground dark:border-blue-400/60 dark:bg-blue-500/20"
                    : "border-border bg-background text-muted-foreground hover:border-blue-400/40 hover:bg-accent hover:text-foreground dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 dark:hover:text-white",
                )}
              >
                {t(preset.labelKey)}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <section className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground dark:border-slate-800 dark:bg-[#06101f] dark:text-slate-400">
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}</span>
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-5 text-sm text-rose-700 dark:text-rose-100">{error}</section>
        ) : filtered.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-blue-400/25 bg-card p-10 text-center dark:bg-[#06101f]">
            <ClipboardCheck className="mx-auto h-10 w-10 text-blue-600 dark:text-blue-300" />
            <h3 className="mt-3 text-base font-black text-foreground dark:text-white">{t("onboardingQueue.emptyTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">{t("onboardingQueue.emptyBody")}</p>
          </section>
        ) : (
          <section className="space-y-4">
            <p className="text-sm text-muted-foreground dark:text-slate-400">
              {t("onboardingQueue.showingClients", {
                visible: Math.min(visibleItems.length, filtered.length),
                total: filtered.length,
              })}
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleItems.map((item) => (
                <OnboardingClientCard
                  key={item.id}
                  item={item}
                  t={t}
                  locale={locale}
                  pinned={pinnedCompanyIds.has(item.company_id)}
                  onPinnedChange={handlePinnedChange}
                />
              ))}
            </div>
            {visibleItems.length < filtered.length ? (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + ONBOARDING_CARD_PAGE_SIZE)}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-foreground transition hover:border-blue-400/60 hover:bg-accent dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-100"
                >
                  {t("onboardingQueue.loadMoreClients", { count: filtered.length - visibleItems.length })}
                </button>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </>
  );
}

function OnboardingClientCard({
  item,
  t,
  locale,
  pinned,
  onPinnedChange,
}: {
  item: ClientOnboarding;
  t: Translate;
  locale: string;
  pinned: boolean;
  onPinnedChange: (companyId: string, pinned: boolean) => void;
}) {
  const companyName = item.company?.name ?? t("clients.unknownClient");
  const workflowHref = `/onboarding/${item.company_id}`;
  const next = nextAction(item);
  const itemBlockers = blockers(item, t);
  const completeSteps = (item.checklist_items ?? []).filter((check) => check.status === "complete").length;
  const totalSteps = Math.max((item.checklist_items ?? []).length, 1);
  const progress = Math.max(0, Math.min(item.progress, 100));
  const owner =
    next?.owner ??
    item.service_assignments?.find((assignment) => assignment.leader)?.leader ??
    item.salesperson ??
    null;
  const services = item.contracted_services ?? [];
  const visibleServices = services.slice(0, 2);
  const remainingServices = Math.max(0, services.length - visibleServices.length);
  const nextTitle = next
    ? onboardingTitleLabel(next.title, t)
    : t("onboardingBoard.readyToStart");
  const blockerSummary = itemBlockers[0] ?? t("onboardingBoard.noCriticalBlockers");

  return (
    <article className="upflow-client-card group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors hover:border-blue-400/40 hover:bg-accent/40 dark:border-blue-400/25 dark:bg-[#07101f] dark:hover:border-blue-300/50 dark:hover:bg-[#091426]">
      <div className="flex h-full flex-col p-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <Link href={workflowHref} className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-300/30 bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-950 text-white shadow-sm">
              <Building2 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground dark:text-blue-200/50">
                {t("onboardingQueue.clientCard")}
              </p>
              <h3 className="mt-0.5 truncate text-lg font-bold leading-tight text-foreground dark:text-white">
                {companyName}
              </h3>
              <span className={cn("mt-1.5 inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold", statusClass(item.status))}>
                {statusLabel(item.sequence_status || item.status, t)}
              </span>
            </div>
          </Link>
          <ClientPinButton
            companyId={item.company_id}
            companyName={companyName}
            pinned={pinned}
            onPinnedChange={onPinnedChange}
            className="h-8 w-8"
          />
        </div>

        <Link
          href={workflowHref}
          className="mt-4 flex min-h-0 flex-1 flex-col gap-3 rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <div className="rounded-lg border border-border bg-muted/30 p-3 dark:border-blue-200/20 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted-foreground dark:text-blue-100/70">{t("onboardingBoard.overallProgress")}</span>
              <span className="text-lg font-black text-foreground dark:text-white">{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted dark:bg-slate-950/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground dark:text-blue-100/60">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-300" />
              {t("onboardingBoard.stepsComplete", { complete: completeSteps, total: totalSteps })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-2.5 dark:border-blue-200/20 dark:bg-white/5">
              <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-blue-100/50">
                {t("onboardingBoard.expectedStart")}
              </p>
              <p className="mt-0.5 truncate text-xs font-bold text-foreground dark:text-white">
                {item.expected_start_date ? formatDate(item.expected_start_date, locale) : t("onboardingBoard.notSet")}
              </p>
            </div>
            <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-2.5 dark:border-blue-200/20 dark:bg-white/5">
              <UserRound className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-blue-100/50">
                {t("onboardingQueue.cardOwner")}
              </p>
              <p className="mt-0.5 truncate text-xs font-bold text-foreground dark:text-white">
                {owner?.name ?? t("onboardingBoard.notAssigned")}
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground dark:text-blue-100/50">
              {t("clients.planServices")}
            </p>
            <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
              {visibleServices.length > 0 ? visibleServices.map((service) => (
                <span key={service} className="max-w-full truncate rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px] font-semibold text-muted-foreground dark:border-blue-200/20 dark:bg-white/5 dark:text-blue-100/80">
                  {service}
                </span>
              )) : (
                <span className="text-xs text-muted-foreground dark:text-blue-100/60">{t("onboardingBoard.servicesPending")}</span>
              )}
              {remainingServices > 0 ? (
                <span className="rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px] font-semibold text-muted-foreground dark:border-blue-200/20 dark:bg-white/5 dark:text-blue-100/70">
                  {t("clients.moreServices", { count: remainingServices })}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-blue-400/20 bg-blue-500/5 p-2.5 dark:bg-blue-500/10">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-200/70">
              {t("onboardingBoard.nextAction")}
            </p>
            <p className="mt-1 line-clamp-2 text-xs font-bold text-foreground dark:text-white">{nextTitle}</p>
          </div>

          <div className={cn(
            "rounded-lg border p-2.5",
            itemBlockers.length
              ? "border-rose-400/25 bg-rose-500/10"
              : "border-emerald-400/25 bg-emerald-500/10",
          )}>
            <p className={cn(
              "flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em]",
              itemBlockers.length
                ? "text-rose-700 dark:text-rose-200"
                : "text-emerald-700 dark:text-emerald-200",
            )}>
              {itemBlockers.length ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {itemBlockers.length ? t("onboardingBoard.blockerCount", { count: itemBlockers.length }) : t("onboardingBoard.noCriticalBlockers")}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-foreground/80 dark:text-slate-200/80">{blockerSummary}</p>
          </div>
        </Link>

        <Link
          href={workflowHref}
          className="mt-4 inline-flex items-center justify-center gap-2 border-t border-border pt-3 text-sm font-bold text-blue-700 transition hover:text-blue-600 dark:border-blue-200/15 dark:text-blue-200 dark:hover:text-white"
        >
          <Rocket className="h-4 w-4" /> {t("onboardingBoard.openWorkflow")}
        </Link>
      </div>
    </article>
  );
}
