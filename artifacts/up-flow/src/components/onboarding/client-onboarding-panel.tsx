"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileLock2,
  Loader2,
  Lock,
  RefreshCcw,
  Send,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import type { ClientOnboarding, Company, OnboardingChecklistItem, OnboardingMeeting } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Props = {
  companyId?: string | null;
  projectId?: string | null;
  company?: Partial<Company> | null;
  onChanged?: () => void;
};

type OnboardingResponse = { items?: ClientOnboarding[] };

function statusLabel(status: string, t: (key: string) => string) {
  const key = `onboardingWorkflow.status.${status}`;
  const value = t(key);
  return value === key ? status.replaceAll("_", " ") : value;
}

function statusClass(status: string) {
  if (status === "onboarding_complete" || status === "complete") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "onboarding_in_progress" || status === "in_progress") return "border-blue-400/30 bg-blue-400/10 text-blue-100";
  return "border-amber-400/25 bg-amber-400/10 text-amber-100";
}

function localDateTimeValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ClientOnboardingPanel({ companyId, projectId, company, onChanged }: Props) {
  const { t } = useLanguage();
  const [onboarding, setOnboarding] = useState<ClientOnboarding | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [finance, setFinance] = useState({
    legal_name: company?.legal_name ?? "",
    cnpj: company?.cnpj ?? "",
    billing_email: company?.billing_email ?? "",
    main_contact_email: company?.main_contact_email ?? "",
    phone: company?.phone ?? "",
    whatsapp: company?.whatsapp ?? "",
    address: company?.address ?? "",
    billing_notes: company?.billing_notes ?? "",
    contract_value: company?.contract_value != null ? String(company.contract_value) : "",
    payment_terms: company?.payment_terms ?? "",
    contract_start_date: company?.contract_start_date ? localDateTimeValue(company.contract_start_date) : "",
  });
  const [support, setSupport] = useState({ group_link: "", notes: "" });
  const [meetings, setMeetings] = useState<Record<string, { scheduled_at: string; meeting_url: string; notes: string }>>({});

  const load = async () => {
    if (!companyId && !projectId) return;
    setLoading(true);
    try {
      const query = projectId ? `project_id=${projectId}` : `company_id=${companyId}`;
      const res = await fetch(`/api/onboarding?${query}`);
      if (!res.ok) throw new Error(t("onboardingWorkflow.loadFailed"));
      const payload = (await res.json()) as OnboardingResponse;
      const first = payload.items?.[0] ?? null;
      setOnboarding(first);
      if (first?.support_group) {
        setSupport({
          group_link: first.support_group.group_link ?? "",
          notes: first.support_group.notes ?? "",
        });
      }
      if (first?.meetings) {
        setMeetings(
          Object.fromEntries(
            first.meetings.map((meeting) => [
              meeting.service,
              {
                scheduled_at: localDateTimeValue(meeting.scheduled_at),
                meeting_url: meeting.meeting_url ?? "",
                notes: meeting.notes ?? "",
              },
            ]),
          ),
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, projectId]);

  useEffect(() => {
    setFinance({
      legal_name: company?.legal_name ?? "",
      cnpj: company?.cnpj ?? "",
      billing_email: company?.billing_email ?? "",
      main_contact_email: company?.main_contact_email ?? "",
      phone: company?.phone ?? "",
      whatsapp: company?.whatsapp ?? "",
      address: company?.address ?? "",
      billing_notes: company?.billing_notes ?? "",
      contract_value: company?.contract_value != null ? String(company.contract_value) : "",
      payment_terms: company?.payment_terms ?? "",
      contract_start_date: company?.contract_start_date ? localDateTimeValue(company.contract_start_date) : "",
    });
  }, [company]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, OnboardingChecklistItem[]>();
    for (const item of onboarding?.checklist_items ?? []) {
      const current = groups.get(item.department) ?? [];
      current.push(item);
      groups.set(item.department, current);
    }
    return Array.from(groups.entries());
  }, [onboarding]);

  const refresh = async () => {
    await load();
    onChanged?.();
  };

  const start = async () => {
    if (!projectId) return;
    setStarting(true);
    try {
      const res = await fetch("/api/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("onboardingWorkflow.startFailed"));
      }
      toast.success(t("onboardingWorkflow.started"));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.startFailed"));
    } finally {
      setStarting(false);
    }
  };

  const updateItem = async (item: OnboardingChecklistItem, status: "pending" | "in_progress" | "complete") => {
    if (!onboarding) return;
    setSaving(item.id);
    try {
      const res = await fetch(`/api/onboarding/${onboarding.id}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("onboardingWorkflow.updateFailed"));
      }
      toast.success(t("onboardingWorkflow.updated"));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.updateFailed"));
    } finally {
      setSaving(null);
    }
  };

  const saveFinance = async () => {
    if (!onboarding) return;
    setSaving("finance");
    try {
      const contractValue = finance.contract_value.trim() ? Number(finance.contract_value) : null;
      const res = await fetch(`/api/onboarding/${onboarding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finance: {
            ...finance,
            contract_value: Number.isFinite(contractValue) ? contractValue : null,
            contract_start_date: finance.contract_start_date ? new Date(finance.contract_start_date).toISOString() : null,
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("onboardingWorkflow.financeFailed"));
      }
      toast.success(t("onboardingWorkflow.financeSaved"));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.financeFailed"));
    } finally {
      setSaving(null);
    }
  };

  const saveSupport = async () => {
    if (!onboarding) return;
    setSaving("support");
    try {
      const res = await fetch(`/api/onboarding/${onboarding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          support_group: {
            group_created: true,
            group_link: support.group_link || null,
            notes: support.notes || null,
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("onboardingWorkflow.supportFailed"));
      }
      toast.success(t("onboardingWorkflow.supportSaved"));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.supportFailed"));
    } finally {
      setSaving(null);
    }
  };

  const saveMeeting = async (meeting: OnboardingMeeting) => {
    if (!onboarding) return;
    const form = meetings[meeting.service] ?? { scheduled_at: "", meeting_url: "", notes: "" };
    setSaving(`meeting:${meeting.id}`);
    try {
      const res = await fetch(`/api/onboarding/${onboarding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting: {
            service: meeting.service,
            scheduled: Boolean(form.scheduled_at || form.meeting_url),
            scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
            meeting_url: form.meeting_url || null,
            notes: form.notes || null,
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("onboardingWorkflow.meetingFailed"));
      }
      toast.success(t("onboardingWorkflow.meetingSaved"));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.meetingFailed"));
    } finally {
      setSaving(null);
    }
  };

  const uploadContract = async (file: File | undefined) => {
    if (!onboarding || !file) return;
    setSaving("contract");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/onboarding/${onboarding.id}/contract`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("onboardingWorkflow.contractFailed"));
      }
      toast.success(t("onboardingWorkflow.contractUploaded"));
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.contractFailed"));
    } finally {
      setSaving(null);
    }
  };

  const openContract = async (contractId: string) => {
    if (!onboarding) return;
    try {
      const res = await fetch(`/api/onboarding/${onboarding.id}/contract/${contractId}/download`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("onboardingWorkflow.contractAccessDenied"));
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.contractAccessDenied"));
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-blue-300/10 bg-[#050a18]/50 p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      </section>
    );
  }

  if (!onboarding) {
    return (
      <section className="rounded-2xl border border-blue-300/10 bg-[#050a18]/50 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t("onboardingWorkflow.eyebrow")}</p>
            <h3 className="mt-2 text-xl font-bold text-foreground">{t("onboardingWorkflow.emptyTitle")}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("onboardingWorkflow.emptyBody")}</p>
          </div>
          {projectId && (
            <button
              onClick={start}
              disabled={starting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              {t("onboardingWorkflow.start")}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-blue-300/10 bg-[#050a18]/50 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">{t("onboardingWorkflow.eyebrow")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-bold text-foreground">{t("onboardingWorkflow.title")}</h3>
            <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold capitalize", statusClass(onboarding.status))}>
              {statusLabel(onboarding.status, t)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {onboarding.company?.name} {onboarding.project?.name ? `- ${onboarding.project.name}` : ""}
          </p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/15 bg-white/5 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10"
        >
          <RefreshCcw className="h-4 w-4" /> {t("common.refresh")}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={<ClipboardCheck className="h-4 w-4" />} label={t("onboardingWorkflow.progress")} value={`${onboarding.progress}%`} />
        <Metric icon={<BriefcaseBusiness className="h-4 w-4" />} label={t("onboardingWorkflow.salesperson")} value={onboarding.salesperson?.name ?? t("companyDialog.notAssigned")} />
        <Metric icon={<CalendarClock className="h-4 w-4" />} label={t("onboardingWorkflow.expectedStart")} value={onboarding.expected_start_date ? formatDate(onboarding.expected_start_date) : t("clients.nextDeadlineNotSet")} />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label={t("onboardingWorkflow.contracts")} value={String(onboarding.contracts?.length ?? 0)} />
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all" style={{ width: `${onboarding.progress}%` }} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Panel title={t("onboardingWorkflow.checklist")} icon={<CheckCircle2 className="h-4 w-4" />}>
            <div className="space-y-4">
              {groupedItems.map(([department, items]) => (
                <div key={department} className="rounded-xl border border-blue-300/10 bg-white/[0.03] p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/55">{department}</p>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-white/8 bg-[#070d1c]/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.owner?.name ?? t("companyDialog.notAssigned")} {item.task ? `- ${item.task.title}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", statusClass(item.status))}>{statusLabel(item.status, t)}</span>
                          {item.status !== "complete" && (
                            <button
                              onClick={() => updateItem(item, "complete")}
                              disabled={saving === item.id}
                              className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
                            >
                              {saving === item.id ? t("common.saving") : t("onboardingWorkflow.markDone")}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={t("onboardingWorkflow.serviceMeetings")} icon={<CalendarClock className="h-4 w-4" />}>
            <div className="space-y-3">
              {(onboarding.meetings ?? []).map((meeting) => {
                const form = meetings[meeting.service] ?? { scheduled_at: "", meeting_url: "", notes: "" };
                return (
                  <div key={meeting.id} className="rounded-xl border border-blue-300/10 bg-white/[0.03] p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{meeting.service}</p>
                        <p className="text-xs text-muted-foreground">{meeting.leader?.name ?? t("companyDialog.notAssigned")}</p>
                      </div>
                      <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", statusClass(meeting.scheduled ? "complete" : "pending"))}>
                        {meeting.scheduled ? t("onboardingWorkflow.scheduled") : t("onboardingWorkflow.notScheduled")}
                      </span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                      <input
                        type="datetime-local"
                        value={form.scheduled_at}
                        onChange={(e) => setMeetings((current) => ({ ...current, [meeting.service]: { ...form, scheduled_at: e.target.value } }))}
                        className="rounded-lg border border-white/10 bg-[#0b1223] px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400"
                      />
                      <input
                        value={form.meeting_url}
                        onChange={(e) => setMeetings((current) => ({ ...current, [meeting.service]: { ...form, meeting_url: e.target.value } }))}
                        placeholder={t("onboardingWorkflow.meetingUrl")}
                        className="rounded-lg border border-white/10 bg-[#0b1223] px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400"
                      />
                      <button
                        onClick={() => saveMeeting(meeting)}
                        disabled={saving === `meeting:${meeting.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" /> {t("common.save")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={t("onboardingWorkflow.finance")} icon={<BriefcaseBusiness className="h-4 w-4" />}>
            <div className="grid gap-2 sm:grid-cols-2">
              <SmallInput label={t("onboardingWorkflow.legalName")} value={finance.legal_name} onChange={(legal_name) => setFinance((f) => ({ ...f, legal_name }))} />
              <SmallInput label="CNPJ" value={finance.cnpj} onChange={(cnpj) => setFinance((f) => ({ ...f, cnpj }))} />
              <SmallInput label={t("onboardingWorkflow.billingEmail")} value={finance.billing_email} onChange={(billing_email) => setFinance((f) => ({ ...f, billing_email }))} />
              <SmallInput label={t("onboardingWorkflow.mainContactEmail")} value={finance.main_contact_email} onChange={(main_contact_email) => setFinance((f) => ({ ...f, main_contact_email }))} />
              <SmallInput label={t("companyDialog.phone")} value={finance.phone} onChange={(phone) => setFinance((f) => ({ ...f, phone }))} />
              <SmallInput label="WhatsApp" value={finance.whatsapp} onChange={(whatsapp) => setFinance((f) => ({ ...f, whatsapp }))} />
              <SmallInput label={t("clients.contract")} value={finance.contract_value} onChange={(contract_value) => setFinance((f) => ({ ...f, contract_value }))} />
              <SmallInput label={t("onboardingWorkflow.paymentTerms")} value={finance.payment_terms} onChange={(payment_terms) => setFinance((f) => ({ ...f, payment_terms }))} />
              <SmallInput
                label={t("onboardingWorkflow.contractStartDate")}
                type="datetime-local"
                value={finance.contract_start_date}
                onChange={(contract_start_date) => setFinance((f) => ({ ...f, contract_start_date }))}
              />
              <SmallInput label={t("onboardingWorkflow.address")} value={finance.address} onChange={(address) => setFinance((f) => ({ ...f, address }))} />
            </div>
            <SmallTextarea label={t("onboardingWorkflow.billingNotes")} value={finance.billing_notes} onChange={(billing_notes) => setFinance((f) => ({ ...f, billing_notes }))} />
            <button
              onClick={saveFinance}
              disabled={saving === "finance"}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-60"
            >
              {saving === "finance" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("onboardingWorkflow.saveFinance")}
            </button>
          </Panel>

          <Panel title={t("onboardingWorkflow.privateContract")} icon={<FileLock2 className="h-4 w-4" />}>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300/25 bg-blue-400/5 px-3 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-400/10">
              {saving === "contract" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t("onboardingWorkflow.uploadContract")}
              <input type="file" className="hidden" onChange={(e) => void uploadContract(e.target.files?.[0])} />
            </label>
            <div className="mt-3 space-y-2">
              {(onboarding.contracts ?? []).map((contract) => (
                <button
                  key={contract.id}
                  onClick={() => openContract(contract.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/8 bg-[#070d1c]/75 px-3 py-2 text-left text-sm text-foreground hover:bg-white/8"
                >
                  <span className="min-w-0 truncate">{contract.file_name}</span>
                  <Lock className="h-4 w-4 shrink-0 text-blue-200/70" />
                </button>
              ))}
              {(onboarding.contracts ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("onboardingWorkflow.noContract")}</p>}
            </div>
          </Panel>

          <Panel title={t("onboardingWorkflow.supportGroup")} icon={<Users className="h-4 w-4" />}>
            <div className="space-y-2">
              <input
                value={support.group_link}
                onChange={(e) => setSupport((current) => ({ ...current, group_link: e.target.value }))}
                placeholder={t("onboardingWorkflow.groupLink")}
                className="w-full rounded-lg border border-white/10 bg-[#0b1223] px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400"
              />
              <textarea
                value={support.notes}
                onChange={(e) => setSupport((current) => ({ ...current, notes: e.target.value }))}
                placeholder={t("onboardingWorkflow.supportNotes")}
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-[#0b1223] px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400"
              />
              <button
                onClick={saveSupport}
                disabled={saving === "support"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-60"
              >
                {saving === "support" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t("onboardingWorkflow.markGroupCreated")}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-blue-300/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2 text-blue-200/70">{icon}<span className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</span></div>
      <p className="truncate text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-blue-300/10 bg-[#071024]/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">{icon}{title}</div>
      {children}
    </div>
  );
}

function SmallInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-100/55">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-white/10 bg-[#0b1223] px-3 text-sm text-foreground outline-none focus:border-blue-400"
      />
    </label>
  );
}

function SmallTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-2 block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-100/55">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-20 w-full resize-none rounded-lg border border-white/10 bg-[#0b1223] px-3 py-2 text-sm text-foreground outline-none focus:border-blue-400"
      />
    </label>
  );
}
