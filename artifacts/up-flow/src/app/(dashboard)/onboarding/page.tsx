"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  DollarSign,
  FileText,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Palette,
  RefreshCcw,
  Rocket,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";
import ClientPinButton from "@/components/clients/client-pin-button";
import { onboardingTitleLabel } from "@/lib/onboarding-labels";
import type { AppUser, ClientOnboarding, OnboardingChecklistItem } from "@/lib/types";
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

const stageDefinitions = [
  { key: "commercial", labelKey: "onboardingBoard.stage.commercial", department: "Commercial" },
  { key: "finance", labelKey: "onboardingBoard.stage.finance", department: "Finance" },
  { key: "contract", labelKey: "onboardingBoard.stage.contract", department: "Contract" },
  { key: "assignment", labelKey: "onboardingBoard.stage.assignment", department: "Internal Assignment" },
  { key: "support", labelKey: "onboardingBoard.stage.support", department: "Support" },
  { key: "department", labelKey: "onboardingBoard.stage.department", department: "Marketing" },
  { key: "creative", labelKey: "onboardingBoard.stage.creative", department: "Creative & Design" },
  { key: "meeting", labelKey: "onboardingBoard.stage.meeting", department: "Meeting" },
  { key: "ready", labelKey: "onboardingBoard.stage.ready", department: "Ready" },
];

function statusLabel(status: string, t: Translate) {
  const key = `onboardingWorkflow.status.${status}`;
  const translated = t(key);
  return translated === key ? status.replaceAll("_", " ") : translated;
}

function statusClass(status: string) {
  if (status === "onboarding_complete" || status === "complete" || status === "marketing_b2b_ready") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200";
  if (status === "needs_mapping") return "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-200";
  if (status.includes("in_progress")) return "border-blue-400/30 bg-blue-400/10 text-blue-700 dark:text-blue-100";
  return "border-amber-400/25 bg-amber-400/10 text-amber-800 dark:text-amber-100";
}

function missingMappings(item: ClientOnboarding) {
  return (item.service_assignments ?? []).filter((assignment) => assignment.status === "needs_mapping" || !assignment.leader_id);
}

function usesUpZero(item: ClientOnboarding) {
  return (item.contracted_services ?? []).some(
    (service) => service.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ") === "up zero",
  );
}

function upZeroTechnicalItem(item: ClientOnboarding) {
  return (item.checklist_items ?? []).find(
    (check) => check.automation_key === "up_zero_website_configuration",
  ) ?? null;
}

function marketingB2BBlockedByUpZero(item: ClientOnboarding) {
  return (
    usesUpZero(item) &&
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
  if ((item.checklist_items ?? []).some((check) => check.department === "Finance" && check.status !== "complete")) results.push(t("onboardingBoard.blocker.finance"));
  if ((item.contracts ?? []).length === 0) results.push(t("onboardingBoard.blocker.contract"));
  if (missingMappings(item).length > 0) results.push(t("onboardingBoard.blocker.owners"));
  if (!item.support_group?.group_created) results.push(t("onboardingBoard.blocker.group"));
  if ((item.meetings ?? []).some((meeting) => !meeting.scheduled)) results.push(t("onboardingBoard.blocker.meeting"));
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
  const dueDates = [item.expected_start_date, ...(item.checklist_items ?? []).map((check) => check.due_date)].filter(Boolean) as string[];
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
            <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-foreground transition hover:border-blue-400/60 hover:bg-accent dark:border-blue-300/20 dark:bg-slate-950/50 dark:text-slate-100">
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
          <section className="space-y-5">
            {filtered.map((item) => (
              <ReadinessBoard
                key={item.id}
                item={item}
                t={t}
                locale={locale}
                pinned={pinnedCompanyIds.has(item.company_id)}
                onPinnedChange={handlePinnedChange}
              />
            ))}
          </section>
        )}
      </main>
    </>
  );
}

function ReadinessBoard({
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
  const next = nextAction(item);
  const itemBlockers = blockers(item, t);
  const completeSteps = (item.checklist_items ?? []).filter((check) => check.status === "complete").length;
  const totalSteps = Math.max((item.checklist_items ?? []).length, 1);
  const technicalItem = upZeroTechnicalItem(item);
  const upZeroBlocked = marketingB2BBlockedByUpZero(item);
  const owner = !item.commercial_completed_at
    ? item.salesperson ?? null
    : upZeroBlocked
      ? technicalItem?.owner ?? null
      : item.service_assignments?.find((assignment) => assignment.leader)?.leader ?? item.salesperson ?? null;
  const currentDepartment = !item.commercial_completed_at
    ? t("onboardingBoard.department.commercial")
    : upZeroBlocked
      ? t("onboardingBoard.department.technicalSupport")
      : t("onboardingBoard.department.marketingB2B");
  const services = item.contracted_services?.slice(0, 4).join(", ") || t("onboardingBoard.servicesPending");
  const creativeItems = (item.checklist_items ?? []).filter((entry) => {
    const text = `${entry.department} ${entry.title}`.toLowerCase();
    return text.includes("creative") || text.includes("design") || text.includes("visita");
  });

  return (
    <article className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm dark:border-blue-500/30 dark:bg-[#07152b] dark:shadow-[0_20px_80px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="truncate text-2xl font-black text-foreground dark:text-white">{item.company?.name ?? t("clients.unknownClient")}</h3>
                  <span className={cn("rounded-lg border px-3 py-1 text-xs font-black", statusClass(item.status))}>{statusLabel(item.sequence_status || item.status, t)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">B2B - {services}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ClientPinButton
                companyId={item.company_id}
                companyName={item.company?.name ?? t("clients.unknownClient")}
                pinned={pinned}
                onPinnedChange={onPinnedChange}
              />
              <Link href={`/clients/${item.company_id}`} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-foreground hover:border-blue-400/60 hover:bg-accent dark:border-slate-700 dark:bg-transparent dark:text-slate-200">
                <FileText className="h-4 w-4" /> {t("onboardingBoard.editClient")}
              </Link>
              <Link href={`/clients/${item.company_id}`} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2 text-sm font-black text-primary-foreground">
                <Rocket className="h-4 w-4" /> {t("onboardingBoard.openWorkflow")}
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-4 border-t border-border pt-4 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-5">
            <MetricPill label={t("onboardingBoard.overallProgress")} value={`${item.progress}%`} progress={item.progress} />
            <MetricLine icon={CalendarDays} label={t("onboardingBoard.expectedStart")} value={item.expected_start_date ? formatDate(item.expected_start_date, locale) : t("onboardingBoard.notSet")} />
            <MetricLine icon={UserRound} label={t("onboardingBoard.salesOwner")} value={item.salesperson?.name ?? t("onboardingBoard.notAssigned")} />
            <MetricLine icon={Users} label={t("onboardingBoard.currentOwner", { department: currentDepartment })} value={owner?.name ?? t("onboardingBoard.notAssigned")} />
            <MetricLine icon={DollarSign} label={t("onboardingBoard.contractValue")} value={t("onboardingBoard.toBeDefined")} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 dark:border-blue-500/25 dark:bg-[#07152b]">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-[repeat(9,minmax(0,1fr))]">
            {stageDefinitions.map((stage, index) => {
              const check = findStageItem(item.checklist_items ?? [], stage.department, stage.key);
              const state = check?.status === "complete" ? "done" : check?.status === "in_progress" ? "review" : index > completeSteps ? "locked" : "pending";
              return <StageStep key={stage.key} index={index + 1} label={t(stage.labelKey)} state={state} t={t} />;
            })}
          </div>
        </section>

        <section className="space-y-2">
          <WorkflowRow index={1} icon={ClipboardCheck} title={t("onboardingBoard.stage.commercial")} status={t("onboardingBoard.completed")} tone="green" meta={[t("onboardingBoard.brandType", { type: "B2B" }), t("onboardingBoard.plan", { services })]} action={t("onboardingBoard.editPlan")} />
          <WorkflowRow index={2} icon={DollarSign} title={t("onboardingBoard.financeRegistration")} status={statusFromDepartment(item, "Finance", t)} tone="blue" meta={[t("onboardingBoard.brandName"), "CNPJ", t("onboardingBoard.phone"), t("onboardingBoard.email"), t("onboardingBoard.monthlyFee")]} action={t("onboardingBoard.openFinanceForm")} />
          <WorkflowRow index={3} icon={LockKeyhole} title={t("onboardingBoard.privateContract")} status={(item.contracts ?? []).length ? t("onboardingBoard.sent") : t("onboardingBoard.notSent")} tone={(item.contracts ?? []).length ? "green" : "amber"} meta={[t("onboardingBoard.uploadContract"), t("onboardingBoard.validation")]} action={t("onboardingBoard.uploadContract")} />
          <WorkflowRow index={4} icon={Users} title={t("onboardingBoard.serviceLeaderAssignment")} status={missingMappings(item).length ? t("onboardingBoard.needsMapping") : t("onboardingBoard.assigned")} tone={missingMappings(item).length ? "amber" : "green"} meta={(item.service_assignments ?? []).slice(0, 4).map((assignment) => `${assignment.service}: ${assignment.leader?.name ?? t("onboardingBoard.noOwner")}`)} action={t("common.save")} />
          <WorkflowRow index={5} icon={MessageSquare} title={t("onboardingBoard.stage.support")} status={item.support_group?.group_created ? t("onboardingBoard.groupCreated") : t("onboardingBoard.pending")} tone={item.support_group?.group_created ? "green" : "blue"} meta={[item.support_group?.group_name ?? t("onboardingBoard.communicationGroup"), item.support_group?.group_link ?? t("onboardingBoard.pendingGroupLink")]} action={t("onboardingBoard.saveGroupLink")} />
          {usesUpZero(item) ? (
            <WorkflowRow
              index={6}
              icon={LockKeyhole}
              title={t("onboardingBoard.upZeroTechnicalSupport")}
              status={technicalItem?.status === "complete" ? t("onboardingBoard.completed") : technicalItem?.status === "in_progress" ? t("onboardingBoard.inProgress") : t("onboardingBoard.pending")}
              tone={technicalItem?.status === "complete" ? "green" : "amber"}
              meta={[
                technicalItem ? onboardingTitleLabel(technicalItem.title, t) : t("onboardingBoard.configureUpZero"),
                t("onboardingBoard.owner", { owner: technicalItem?.owner?.name ?? t("onboardingBoard.technicalSupportPending") }),
              ]}
              action={t("onboardingBoard.openTask")}
            />
          ) : null}
          <WorkflowRow index={usesUpZero(item) ? 7 : 6} icon={ClipboardCheck} title={t("onboardingBoard.marketingB2BOnboarding")} status={upZeroBlocked ? t("onboardingBoard.blocked") : statusFromDepartment(item, "Marketing B2B", t)} tone={upZeroBlocked ? "amber" : "purple"} meta={upZeroBlocked ? [t("onboardingBoard.blocker.upZero")] : [t("onboardingBoard.openForm"), t("onboardingBoard.requestMissingInfo"), t("onboardingBoard.markComplete")]} action={t("onboardingBoard.openForm")} />
          <WorkflowRow index={usesUpZero(item) ? 8 : 7} icon={Palette} title={t("onboardingBoard.stage.creative")} status={statusFromDepartment(item, "Creative", t)} tone="purple" meta={creativeItems.length ? creativeItems.slice(0, 3).map((entry) => `${onboardingTitleLabel(entry.title, t)}: ${entry.status === "complete" ? t("onboardingBoard.completed") : t("onboardingBoard.pending")}`) : [t("onboardingBoard.brandGuidelineMeeting"), t("onboardingBoard.technicalVisit")]} action={t("onboardingBoard.openCreativeTasks")} />
          <WorkflowRow index={usesUpZero(item) ? 9 : 8} icon={CalendarDays} title={t("onboardingBoard.meetings")} status={(item.meetings ?? []).every((meeting) => meeting.scheduled) ? t("onboardingBoard.scheduledPlural") : t("onboardingBoard.notScheduled")} tone="rose" meta={(item.meetings ?? []).slice(0, 3).map((meeting) => `${meeting.service}: ${meeting.scheduled ? t("onboardingBoard.scheduled") : t("onboardingBoard.notScheduled")}`)} action={t("common.save")} />
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4 dark:border-slate-800 dark:bg-[#07152b]">
            <p className="text-sm font-black text-foreground dark:text-white">{t("onboardingBoard.notes")}</p>
            <div className="mt-3 h-20 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-500">{t("onboardingBoard.internalNotePlaceholder")}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 dark:border-slate-800 dark:bg-[#07152b]">
            <p className="text-sm font-black text-foreground dark:text-white">{t("onboardingBoard.activity")}</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground dark:text-slate-400">
              {(item.checklist_items ?? []).slice(0, 5).map((check) => (
                <div key={check.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{onboardingTitleLabel(check.title, t)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground dark:text-slate-500">{check.completed_at ? formatDate(check.completed_at, locale) : t("onboardingBoard.pending")}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <SideProgress item={item} completeSteps={completeSteps} totalSteps={totalSteps} t={t} />
        <section className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5">
          <h4 className="flex items-center gap-2 font-black text-rose-800 dark:text-rose-100"><AlertTriangle className="h-4 w-4" /> {t("onboardingBoard.criticalBlockers")}</h4>
          <div className="mt-4 space-y-3">
            {itemBlockers.length ? itemBlockers.map((blocker) => (
              <p key={blocker} className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-100/80"><Circle className="h-3 w-3" /> {blocker}</p>
            )) : <p className="text-sm text-emerald-700 dark:text-emerald-200">{t("onboardingBoard.noCriticalBlockers")}</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
          <h4 className="flex items-center gap-2 font-black text-foreground dark:text-white"><Rocket className="h-4 w-4 text-blue-600 dark:text-blue-300" /> {t("onboardingBoard.nextAction")}</h4>
          <p className="mt-4 font-black text-foreground dark:text-white">{upZeroBlocked ? t("onboardingBoard.configureUpZero") : next ? onboardingTitleLabel(next.title, t) : t("onboardingBoard.readyToStart")}</p>
          <p className="mt-1 text-sm text-muted-foreground dark:text-slate-300">{upZeroBlocked ? t("onboardingBoard.blocker.upZero") : next ? t("onboardingBoard.completeStepToUnlock") : t("onboardingBoard.allRequiredComplete")}</p>
          <Link href={`/clients/${item.company_id}`} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-black text-primary-foreground">{t("onboardingBoard.openWorkflow")}</Link>
        </section>
      </aside>
    </article>
  );
}

function findStageItem(items: OnboardingChecklistItem[], department: string, key: string) {
  if (key === "department") return items.find((item) => item.department.includes("Marketing") || item.title.toLowerCase().includes("marketing"));
  if (key === "creative") {
    return items.find((item) => {
      const text = `${item.department} ${item.title}`.toLowerCase();
      return text.includes("creative") || text.includes("design") || text.includes("visita");
    });
  }
  if (key === "meeting") return items.find((item) => item.title.toLowerCase().includes("meeting") || item.title.toLowerCase().includes("kickoff"));
  if (key === "ready") return items.every((item) => item.status === "complete") ? items[items.length - 1] : null;
  return items.find((item) => item.department === department || item.title.toLowerCase().includes(department.toLowerCase()));
}

function statusFromDepartment(item: ClientOnboarding, department: string, t: Translate) {
  const check = (item.checklist_items ?? []).find((entry) => entry.department === department || entry.department.includes(department));
  if (!check) return t("onboardingBoard.pending");
  if (check.status === "complete") return t("onboardingBoard.completed");
  if (check.status === "in_progress") return t("onboardingBoard.inReview");
  return t("onboardingBoard.pending");
}

function StageStep({ index, label, state, t }: { index: number; label: string; state: "done" | "review" | "pending" | "locked"; t: Translate }) {
  const classes = {
    done: "border-emerald-400 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    review: "border-violet-400 bg-violet-500/10 text-violet-700 dark:text-violet-200",
    pending: "border-amber-400 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    locked: "border-border bg-muted text-muted-foreground dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
  }[state];
  return (
    <div className="min-w-0 text-center">
      <div className={cn("mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black", classes)}>{index}</div>
      <p className="mt-2 truncate text-xs font-bold text-foreground dark:text-slate-300">{label}</p>
      <span className={cn("mt-2 inline-flex rounded-lg px-2 py-1 text-[11px] font-black", classes)}>{state === "done" ? t("onboardingBoard.completed") : state === "locked" ? t("onboardingBoard.locked") : state === "review" ? t("onboardingBoard.inReview") : t("onboardingBoard.pending")}</span>
    </div>
  );
}

function MetricPill({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-muted-foreground dark:text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full" style={{ background: `conic-gradient(#1463ff ${progress * 3.6}deg, hsl(var(--muted)) 0deg)` }} />
        <p className="text-lg font-black text-foreground dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function MetricLine({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="min-w-0 border-border dark:border-slate-800 xl:border-l xl:pl-4">
      <p className="text-xs font-semibold text-muted-foreground dark:text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300"><Icon className="h-4 w-4" /></span>
        <p className="truncate text-sm font-bold text-foreground dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function WorkflowRow({ index, icon: Icon, title, status, tone, meta, action }: { index: number; icon: ComponentType<{ className?: string }>; title: string; status: string; tone: "green" | "blue" | "amber" | "purple" | "rose"; meta: string[]; action: string }) {
  const toneClass = {
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    blue: "border-blue-400/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    purple: "border-violet-400/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  }[tone];
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-3 dark:border-blue-500/20 dark:bg-[#07152b] lg:grid-cols-[44px_170px_minmax(0,1fr)_150px] lg:items-center">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black", toneClass)}>{index}</div>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-slate-950/70 dark:text-blue-300"><Icon className="h-4 w-4" /></span>
        <p className="text-sm font-black text-foreground dark:text-white">{title}</p>
      </div>
      <div className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground dark:text-slate-300">
        {meta.length ? meta.map((item) => <span key={item} className="truncate">{item}</span>) : <span>-</span>}
      </div>
      <div className="flex items-center gap-2 lg:justify-end">
        <span className={cn("rounded-lg border px-2 py-1 text-[11px] font-black", toneClass)}>{status}</span>
        <button type="button" className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-black text-foreground hover:border-blue-400/60 hover:bg-accent dark:border-slate-700 dark:bg-transparent dark:text-slate-200">{action}</button>
      </div>
    </div>
  );
}

function SideProgress({ item, completeSteps, totalSteps, t }: { item: ClientOnboarding; completeSteps: number; totalSteps: number; t: Translate }) {
  const pending = Math.max(totalSteps - completeSteps, 0);
  const itemBlockers = blockers(item, t).length;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-blue-500/30 dark:bg-[#07152b] dark:shadow-[0_20px_80px_rgba(0,0,0,0.32)]">
      <h4 className="font-black text-foreground dark:text-white">{t("onboardingBoard.readiness")}</h4>
      <div className="mx-auto mt-6 flex h-36 w-36 items-center justify-center rounded-full" style={{ background: `conic-gradient(#1463ff ${item.progress * 3.6}deg, hsl(var(--muted)) 0deg)` }}>
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-card dark:bg-[#06101f]"><span className="text-3xl font-black text-foreground dark:text-white">{item.progress}%</span></div>
      </div>
      <div className="mt-6 space-y-3 text-sm text-muted-foreground dark:text-slate-300">
        <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> {t("onboardingBoard.stepsComplete", { complete: completeSteps, total: totalSteps })}</p>
        <p className="flex items-center gap-2"><Circle className="h-4 w-4 text-amber-300" /> {t("onboardingBoard.pendingItems", { count: pending })}</p>
        <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-300" /> {t("onboardingBoard.blockerCount", { count: itemBlockers })}</p>
        <p className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-300" /> {t("onboardingBoard.contractsUploaded", { count: (item.contracts ?? []).length })}</p>
      </div>
    </section>
  );
}
