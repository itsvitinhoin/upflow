"use client";

import { useEffect, useMemo, useState } from "react";
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
  UserRound,
  Users,
} from "lucide-react";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";
import type { AppUser, ClientOnboarding, OnboardingChecklistItem } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type QueueView = "all" | "mine" | "blocked" | "due_week" | "missing_mapping";
type OnboardingResponse = { items?: ClientOnboarding[] };

const VIEWS: Array<{ key: QueueView; labelKey: string }> = [
  { key: "all", labelKey: "onboardingQueue.view.all" },
  { key: "mine", labelKey: "onboardingQueue.view.mine" },
  { key: "blocked", labelKey: "onboardingQueue.view.blocked" },
  { key: "due_week", labelKey: "onboardingQueue.view.dueWeek" },
  { key: "missing_mapping", labelKey: "onboardingQueue.view.missingMapping" },
];

const stageDefinitions = [
  { key: "commercial", label: "Commercial Setup", department: "Commercial" },
  { key: "finance", label: "Finance Setup", department: "Finance" },
  { key: "contract", label: "Contract", department: "Contract" },
  { key: "assignment", label: "Internal Assignment", department: "Internal Assignment" },
  { key: "support", label: "Support Setup", department: "Support" },
  { key: "department", label: "Department Onboarding", department: "Marketing" },
  { key: "creative", label: "Creative & Design", department: "Creative & Design" },
  { key: "meeting", label: "First Meeting", department: "Meeting" },
  { key: "ready", label: "Ready to Start", department: "Ready" },
];

function statusLabel(status: string, t: (key: string) => string) {
  const key = `onboardingWorkflow.status.${status}`;
  const translated = t(key);
  return translated === key ? status.replaceAll("_", " ") : translated;
}

function statusClass(status: string) {
  if (status === "onboarding_complete" || status === "complete" || status === "marketing_b2b_ready") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "needs_mapping") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  if (status.includes("in_progress")) return "border-blue-400/30 bg-blue-400/10 text-blue-100";
  return "border-amber-400/25 bg-amber-400/10 text-amber-100";
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

function blockers(item: ClientOnboarding) {
  const results: string[] = [];
  if (marketingB2BBlockedByUpZero(item)) {
    results.push("Waiting for UP Zero website configuration by Technical Support.");
  }
  if ((item.checklist_items ?? []).some((check) => check.department === "Finance" && check.status !== "complete")) results.push("Finance registration pending");
  if ((item.contracts ?? []).length === 0) results.push("Contract not uploaded");
  if (missingMappings(item).length > 0) results.push("Department owners missing");
  if (!item.support_group?.group_created) results.push("Communication group not created");
  if ((item.meetings ?? []).some((meeting) => !meeting.scheduled)) results.push("First meeting not scheduled");
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
      const [onboardingRes, meRes] = await Promise.all([fetch("/api/onboarding"), fetch("/api/auth/me")]);
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
      <main className="onboarding-queue-shell min-h-screen space-y-5 bg-background p-4 text-foreground dark:bg-[#020817] dark:text-slate-100 sm:p-6">
        <section className="rounded-2xl border border-blue-500/25 bg-[#06101f] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">{t("onboardingQueue.eyebrow")}</p>
              <h2 className="mt-2 text-2xl font-black text-white">{t("onboardingQueue.title")}</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">{t("onboardingQueue.subtitle")}</p>
            </div>
            <button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-slate-950/50 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-blue-400/60">
              <RefreshCcw className="h-4 w-4" /> {t("common.refresh")}
            </button>
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
                    ? "border-blue-400/55 bg-blue-500/20 text-white"
                    : "border-slate-800 bg-slate-950/45 text-slate-400 hover:border-blue-400/40 hover:text-white",
                )}
              >
                {t(preset.labelKey)}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <section className="rounded-2xl border border-slate-800 bg-[#06101f] p-8 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}</span>
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-5 text-sm text-rose-100">{error}</section>
        ) : filtered.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-blue-400/25 bg-[#06101f] p-10 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-blue-300" />
            <h3 className="mt-3 text-base font-black text-white">{t("onboardingQueue.emptyTitle")}</h3>
            <p className="mt-1 text-sm text-slate-400">{t("onboardingQueue.emptyBody")}</p>
          </section>
        ) : (
          <section className="space-y-5">
            {filtered.map((item) => <ReadinessBoard key={item.id} item={item} t={t} />)}
          </section>
        )}
      </main>
    </>
  );
}

function ReadinessBoard({ item, t }: { item: ClientOnboarding; t: (key: string) => string }) {
  const next = nextAction(item);
  const itemBlockers = blockers(item);
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
    ? "Commercial"
    : upZeroBlocked
      ? "Technical Support"
      : "Marketing B2B";
  const services = item.contracted_services?.slice(0, 4).join(", ") || "Servicos em definicao";
  const creativeItems = (item.checklist_items ?? []).filter((entry) => {
    const text = `${entry.department} ${entry.title}`.toLowerCase();
    return text.includes("creative") || text.includes("design") || text.includes("visita");
  });

  return (
    <article className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <section className="rounded-2xl border border-blue-500/30 bg-[#07152b] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.32)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="truncate text-2xl font-black text-white">{item.company?.name ?? t("clients.unknownClient")}</h3>
                  <span className={cn("rounded-lg border px-3 py-1 text-xs font-black", statusClass(item.status))}>{statusLabel(item.sequence_status || item.status, t)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-400">B2B - {services}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/clients/${item.company_id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200 hover:border-blue-400/60">
                <FileText className="h-4 w-4" /> Editar cliente
              </Link>
              <Link href={`/clients/${item.company_id}`} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2 text-sm font-black text-white">
                <Rocket className="h-4 w-4" /> Abrir workflow
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-4 border-t border-slate-800 pt-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricPill label="Progresso geral" value={`${item.progress}%`} progress={item.progress} />
            <MetricLine icon={CalendarDays} label="Data de inicio" value={item.expected_start_date ? formatDate(item.expected_start_date) : "Nao definida"} />
            <MetricLine icon={UserRound} label="Comercial responsavel" value={item.salesperson?.name ?? "Nao atribuido"} />
            <MetricLine icon={Users} label={`Current owner - ${currentDepartment}`} value={owner?.name ?? "Nao atribuido"} />
            <MetricLine icon={DollarSign} label="Valor do contrato" value="A definir" />
          </div>
        </section>

        <section className="rounded-2xl border border-blue-500/25 bg-[#07152b] p-4">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-[repeat(9,minmax(0,1fr))]">
            {stageDefinitions.map((stage, index) => {
              const check = findStageItem(item.checklist_items ?? [], stage.department, stage.key);
              const state = check?.status === "complete" ? "done" : check?.status === "in_progress" ? "review" : index > completeSteps ? "locked" : "pending";
              return <StageStep key={stage.key} index={index + 1} label={stage.label} state={state} />;
            })}
          </div>
        </section>

        <section className="space-y-2">
          <WorkflowRow index={1} icon={ClipboardCheck} title="Commercial Setup" status="Concluido" tone="green" meta={["Tipo de Marca: B2B", `Plano: ${services}`]} action="Editar plano" />
          <WorkflowRow index={2} icon={DollarSign} title="Cadastro financeiro" status={statusFromDepartment(item, "Finance")} tone="blue" meta={["Nome da Marca", "CNPJ", "Telefone", "Email", "Mensalidade"]} action="Open finance form" />
          <WorkflowRow index={3} icon={LockKeyhole} title="Contrato privado" status={(item.contracts ?? []).length ? "Enviado" : "Nao enviado"} tone={(item.contracts ?? []).length ? "green" : "amber"} meta={["Upload contract", "Validacao"]} action="Upload contract" />
          <WorkflowRow index={4} icon={Users} title="Service Leader Assignment" status={missingMappings(item).length ? "Precisa de mapeamento" : "Assigned"} tone={missingMappings(item).length ? "amber" : "green"} meta={(item.service_assignments ?? []).slice(0, 4).map((assignment) => `${assignment.service}: ${assignment.leader?.name ?? "Sem responsavel"}`)} action="Salvar" />
          <WorkflowRow index={5} icon={MessageSquare} title="Support Setup" status={item.support_group?.group_created ? "Grupo criado" : "Pendente"} tone={item.support_group?.group_created ? "green" : "blue"} meta={[item.support_group?.group_name ?? "Grupo de comunicacao", item.support_group?.group_link ?? "Link pendente"]} action="Save group link" />
          {usesUpZero(item) ? (
            <WorkflowRow
              index={6}
              icon={LockKeyhole}
              title="UP Zero - Technical Support"
              status={technicalItem?.status === "complete" ? "Concluido" : technicalItem?.status === "in_progress" ? "Em andamento" : "Pendente"}
              tone={technicalItem?.status === "complete" ? "green" : "amber"}
              meta={[
                technicalItem?.title ?? "Configure UP Zero website",
                `Owner: ${technicalItem?.owner?.name ?? "Technical Support mapping pending"}`,
              ]}
              action="Open task"
            />
          ) : null}
          <WorkflowRow index={usesUpZero(item) ? 7 : 6} icon={ClipboardCheck} title="Marketing B2B Onboarding" status={upZeroBlocked ? "Bloqueado" : statusFromDepartment(item, "Marketing B2B")} tone={upZeroBlocked ? "amber" : "purple"} meta={upZeroBlocked ? ["Waiting for UP Zero website configuration by Technical Support."] : ["Open form", "Request missing info", "Mark as complete"]} action="Open form" />
          <WorkflowRow index={usesUpZero(item) ? 8 : 7} icon={Palette} title="Creative & Design" status={statusFromDepartment(item, "Creative")} tone="purple" meta={creativeItems.length ? creativeItems.slice(0, 3).map((entry) => `${entry.title}: ${entry.status === "complete" ? "Concluido" : "Pendente"}`) : ["Brand guideline meeting", "Visita tecnica"]} action="Open creative tasks" />
          <WorkflowRow index={usesUpZero(item) ? 9 : 8} icon={CalendarDays} title="Meetings" status={(item.meetings ?? []).every((meeting) => meeting.scheduled) ? "Agendadas" : "Nao agendada"} tone="rose" meta={(item.meetings ?? []).slice(0, 3).map((meeting) => `${meeting.service}: ${meeting.scheduled ? "Agendada" : "Nao agendada"}`)} action="Save" />
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-[#07152b] p-4">
            <p className="text-sm font-black text-white">Notas</p>
            <div className="mt-3 h-20 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-500">Escreva uma nota interna...</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#07152b] p-4">
            <p className="text-sm font-black text-white">Atividade</p>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              {(item.checklist_items ?? []).slice(0, 5).map((check) => (
                <div key={check.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{check.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{check.completed_at ? formatDate(check.completed_at) : "Pendente"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <SideProgress item={item} completeSteps={completeSteps} totalSteps={totalSteps} />
        <section className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-5">
          <h4 className="flex items-center gap-2 font-black text-rose-100"><AlertTriangle className="h-4 w-4" /> Critical blockers</h4>
          <div className="mt-4 space-y-3">
            {itemBlockers.length ? itemBlockers.map((blocker) => (
              <p key={blocker} className="flex items-center gap-2 text-sm text-rose-100/85"><Circle className="h-3 w-3" /> {blocker}</p>
            )) : <p className="text-sm text-emerald-200">No critical blockers</p>}
          </div>
        </section>
        <section className="rounded-2xl border border-blue-500/35 bg-blue-500/10 p-5">
          <h4 className="flex items-center gap-2 font-black text-white"><Rocket className="h-4 w-4 text-blue-300" /> Next action</h4>
          <p className="mt-4 font-black text-white">{upZeroBlocked ? "Configure UP Zero website" : next?.title ?? "Ready to start"}</p>
          <p className="mt-1 text-sm text-slate-300">{upZeroBlocked ? "Waiting for UP Zero website configuration by Technical Support." : next ? "Complete this step to unlock the next onboarding stage." : "All required onboarding steps are complete."}</p>
          <Link href={`/clients/${item.company_id}`} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-black text-white">Open Workflow</Link>
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

function statusFromDepartment(item: ClientOnboarding, department: string) {
  const check = (item.checklist_items ?? []).find((entry) => entry.department === department || entry.department.includes(department));
  if (!check) return "Pendente";
  if (check.status === "complete") return "Concluido";
  if (check.status === "in_progress") return "Em revisao";
  return "Pendente";
}

function StageStep({ index, label, state }: { index: number; label: string; state: "done" | "review" | "pending" | "locked" }) {
  const classes = {
    done: "border-emerald-400 bg-emerald-500/15 text-emerald-200",
    review: "border-violet-400 bg-violet-500/15 text-violet-200",
    pending: "border-amber-400 bg-amber-500/15 text-amber-200",
    locked: "border-slate-600 bg-slate-800/45 text-slate-400",
  }[state];
  return (
    <div className="min-w-0 text-center">
      <div className={cn("mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black", classes)}>{index}</div>
      <p className="mt-2 truncate text-xs font-bold text-slate-300">{label}</p>
      <span className={cn("mt-2 inline-flex rounded-lg px-2 py-1 text-[11px] font-black", classes)}>{state === "done" ? "Concluido" : state === "locked" ? "Bloqueado" : state === "review" ? "Em revisao" : "Pendente"}</span>
    </div>
  );
}

function MetricPill({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full" style={{ background: `conic-gradient(#1463ff ${progress * 3.6}deg, #16243d 0deg)` }} />
        <p className="text-lg font-black text-white">{value}</p>
      </div>
    </div>
  );
}

function MetricLine({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="min-w-0 border-slate-800 xl:border-l xl:pl-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Icon className="h-4 w-4" /></span>
        <p className="truncate text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function WorkflowRow({ index, icon: Icon, title, status, tone, meta, action }: { index: number; icon: ComponentType<{ className?: string }>; title: string; status: string; tone: "green" | "blue" | "amber" | "purple" | "rose"; meta: string[]; action: string }) {
  const toneClass = {
    green: "border-emerald-400/35 bg-emerald-500/10 text-emerald-300",
    blue: "border-blue-400/35 bg-blue-500/10 text-blue-300",
    amber: "border-amber-400/35 bg-amber-500/10 text-amber-300",
    purple: "border-violet-400/35 bg-violet-500/10 text-violet-300",
    rose: "border-rose-400/35 bg-rose-500/10 text-rose-300",
  }[tone];
  return (
    <div className="grid gap-3 rounded-2xl border border-blue-500/20 bg-[#07152b] p-3 lg:grid-cols-[44px_170px_minmax(0,1fr)_150px] lg:items-center">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black", toneClass)}>{index}</div>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950/70 text-blue-300"><Icon className="h-4 w-4" /></span>
        <p className="text-sm font-black text-white">{title}</p>
      </div>
      <div className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs text-slate-300">
        {meta.length ? meta.map((item) => <span key={item} className="truncate">{item}</span>) : <span>-</span>}
      </div>
      <div className="flex items-center gap-2 lg:justify-end">
        <span className={cn("rounded-lg border px-2 py-1 text-[11px] font-black", toneClass)}>{status}</span>
        <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-black text-slate-200 hover:border-blue-400/60">{action}</button>
      </div>
    </div>
  );
}

function SideProgress({ item, completeSteps, totalSteps }: { item: ClientOnboarding; completeSteps: number; totalSteps: number }) {
  const pending = Math.max(totalSteps - completeSteps, 0);
  const itemBlockers = blockers(item).length;
  return (
    <section className="rounded-2xl border border-blue-500/30 bg-[#07152b] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.32)]">
      <h4 className="font-black text-white">Onboarding readiness</h4>
      <div className="mx-auto mt-6 flex h-36 w-36 items-center justify-center rounded-full" style={{ background: `conic-gradient(#1463ff ${item.progress * 3.6}deg, #12213a 0deg)` }}>
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#06101f]"><span className="text-3xl font-black text-white">{item.progress}%</span></div>
      </div>
      <div className="mt-6 space-y-3 text-sm text-slate-300">
        <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> {completeSteps} of {totalSteps} steps complete</p>
        <p className="flex items-center gap-2"><Circle className="h-4 w-4 text-amber-300" /> {pending} pending items</p>
        <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-300" /> {itemBlockers} blockers</p>
        <p className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-300" /> {(item.contracts ?? []).length} contracts uploaded</p>
      </div>
    </section>
  );
}
