"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCcw,
  UserRound,
} from "lucide-react";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";
import type { AppUser, ClientOnboarding } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type QueueView = "all" | "mine" | "blocked" | "due_week" | "missing_mapping";

type OnboardingResponse = {
  items?: ClientOnboarding[];
};

const VIEWS: Array<{ key: QueueView; labelKey: string }> = [
  { key: "all", labelKey: "onboardingQueue.view.all" },
  { key: "mine", labelKey: "onboardingQueue.view.mine" },
  { key: "blocked", labelKey: "onboardingQueue.view.blocked" },
  { key: "due_week", labelKey: "onboardingQueue.view.dueWeek" },
  { key: "missing_mapping", labelKey: "onboardingQueue.view.missingMapping" },
];

function statusLabel(status: string, t: (key: string) => string) {
  const key = `onboardingWorkflow.status.${status}`;
  const translated = t(key);
  return translated === key ? status.replaceAll("_", " ") : translated;
}

function statusClass(status: string) {
  if (status === "onboarding_complete" || status === "complete") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (status === "needs_mapping") {
    return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  }
  if (status === "onboarding_in_progress" || status === "in_progress") {
    return "border-blue-400/30 bg-blue-400/10 text-blue-100";
  }
  return "border-amber-400/25 bg-amber-400/10 text-amber-100";
}

function missingMappings(item: ClientOnboarding) {
  return (item.service_assignments ?? []).filter((assignment) => assignment.status === "needs_mapping" || !assignment.leader_id);
}

function blockers(item: ClientOnboarding) {
  const results: string[] = [];
  if (missingMappings(item).length > 0) results.push("missing_mapping");
  if ((item.contracts ?? []).length === 0) results.push("contract");
  if (!item.support_group?.group_created) results.push("support");
  return results;
}

function nextAction(item: ClientOnboarding) {
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
  const { t } = useLanguage();
  const [items, setItems] = useState<ClientOnboarding[]>([]);
  const [user, setUser] = useState<AppUser | null>(null);
  const [view, setView] = useState<QueueView>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [onboardingRes, meRes] = await Promise.all([
        fetch("/api/onboarding"),
        fetch("/api/auth/me"),
      ]);
      if (!onboardingRes.ok) throw new Error(t("onboardingQueue.loadFailed"));
      const payload = (await onboardingRes.json()) as OnboardingResponse;
      setItems(payload.items ?? []);
      if (meRes.ok) setUser((await meRes.json()) as AppUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboardingQueue.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (view === "mine") return items.filter((item) => belongsToMe(item, user?.id ?? null));
    if (view === "blocked") return items.filter((item) => blockers(item).length > 0);
    if (view === "due_week") return items.filter(dueThisWeek);
    if (view === "missing_mapping") return items.filter((item) => missingMappings(item).length > 0);
    return items;
  }, [items, user?.id, view]);

  return (
    <>
      <Header title={t("onboardingQueue.title")} />
      <main className="space-y-5 p-4 sm:p-6">
        <section className="flex flex-col gap-4 rounded-2xl border border-blue-300/12 bg-[#071024]/78 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t("onboardingQueue.eyebrow")}</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">{t("onboardingQueue.title")}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("onboardingQueue.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/15 bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            {t("common.refresh")}
          </button>
        </section>

        <section className="flex flex-wrap gap-2">
          {VIEWS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setView(preset.key)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                view === preset.key
                  ? "border-blue-300/45 bg-blue-500/18 text-white"
                  : "border-white/10 bg-white/[0.03] text-blue-100/65 hover:bg-white/[0.07]",
              )}
            >
              {t(preset.labelKey)}
            </button>
          ))}
        </section>

        {loading ? (
          <section className="rounded-2xl border border-blue-300/10 bg-[#050a18]/60 p-8 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </span>
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
            {error}
          </section>
        ) : filtered.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-blue-300/18 bg-[#050a18]/60 p-10 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-blue-200/55" />
            <h3 className="mt-3 text-base font-bold text-foreground">{t("onboardingQueue.emptyTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("onboardingQueue.emptyBody")}</p>
          </section>
        ) : (
          <section className="grid gap-3">
            {filtered.map((item) => {
              const next = nextAction(item);
              const itemBlockers = blockers(item);
              const missing = missingMappings(item);
              return (
                <Link
                  key={item.id}
                  href={`/clients/${item.company_id}`}
                  className="group rounded-2xl border border-blue-300/10 bg-[#071024]/78 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition hover:border-blue-300/25 hover:bg-[#0a1428]"
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(220px,1.2fr)_160px_minmax(220px,1fr)_minmax(260px,1.2fr)] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-bold text-foreground">{item.company?.name ?? t("clients.unknownClient")}</h3>
                        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize", statusClass(item.status))}>
                          {statusLabel(item.status, t)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {next ? next.title : t("onboardingQueue.noNextAction")}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100/45">{t("onboardingWorkflow.progress")}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" style={{ width: `${item.progress}%` }} />
                        </div>
                        <span className="text-sm font-bold text-foreground">{item.progress}%</span>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      <MetaLine icon={<UserRound className="h-4 w-4" />} label={item.salesperson?.name ?? t("companyDialog.notAssigned")} />
                      <MetaLine
                        icon={<CalendarClock className="h-4 w-4" />}
                        label={item.expected_start_date ? formatDate(item.expected_start_date) : t("clients.nextDeadlineNotSet")}
                      />
                    </div>

                    <div className="min-w-0">
                      {itemBlockers.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {itemBlockers.map((blocker) => (
                            <span key={blocker} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-200">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {t(`onboardingQueue.blocker.${blocker}`)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("onboardingQueue.noBlockers")}
                        </span>
                      )}
                      {missing.length > 0 && (
                        <p className="mt-2 truncate text-xs text-rose-100/72">
                          {t("onboardingQueue.missingServices", { services: missing.map((entry) => entry.service).join(", ") })}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </main>
    </>
  );
}

function MetaLine({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-blue-100/70">
      <span className="shrink-0 text-blue-200/65">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}
