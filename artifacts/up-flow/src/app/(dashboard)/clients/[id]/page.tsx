"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Building2, Calendar, CheckSquare, DollarSign, FileText, FolderKanban, PackageCheck, Pencil, Plus, RefreshCcw, Save, Timer, Trash2, TrendingUp, Users, X } from "lucide-react";
import Header from "@/components/layout/header";
import ClientOnboardingPanel from "@/components/onboarding/client-onboarding-panel";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import type { Company, CompanyContact, CompanyNote, TimeEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

type ClientPayload = Company & { time_entries?: TimeEntry[] };

export default function ClientDetailPage() {
  const { language, t } = useLanguage();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const params = useParams();
  const id = (params?.id ?? "") as string;
  const [company, setCompany] = useState<ClientPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [clientMutationError, setClientMutationError] = useState<string | null>(null);
  const [clientMutationSuccess, setClientMutationSuccess] = useState<string | null>(null);
  const [pendingClientAction, setPendingClientAction] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  } | null>(null);
  const [editingNote, setEditingNote] = useState<{ id: string; body: string } | null>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    service_type: "",
    plan_name: "",
    billing_cycle: "",
    included_services: "",
    plan_notes: "",
  });

  const loadCompany = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    const res = await fetch(`/api/companies/${id}`);
    if (res.status === 404) {
      setNotFoundState(true);
      return;
    }
    const payload = (await res.json()) as ClientPayload;
    setCompany(payload);
    setPlanForm(toPlanForm(payload));
    if (!options?.silent) setLoading(false);
  };

  const showClientMutationError = (message: string) => {
    setClientMutationSuccess(null);
    setClientMutationError(message);
  };

  const showClientMutationSuccess = (message: string) => {
    setClientMutationError(null);
    setClientMutationSuccess(message);
  };

  const parseErrorMessage = async (res: Response, fallback: string) => {
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error === "Forbidden") {
        return t("clientDetail.permissionDenied");
      }
      return payload.error || fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    if (id) loadCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contactName.trim()) return;
    setPendingClientAction("contact:create");
    setClientMutationError(null);
    const res = await fetch(`/api/companies/${id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: contactName.trim(),
        email: contactEmail.trim() || null,
      }),
    });
    if (res.ok) {
      setContactName("");
      setContactEmail("");
      await loadCompany({ silent: true });
      showClientMutationSuccess(t("clientDetail.contactAdded"));
    } else {
      showClientMutationError(await parseErrorMessage(res, t("clientDetail.couldNotAddContact")));
    }
    setPendingClientAction(null);
  };

  const addNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteBody.trim()) return;
    setPendingClientAction("note:create");
    setClientMutationError(null);
    const res = await fetch(`/api/companies/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody.trim() }),
    });
    if (res.ok) {
      setNoteBody("");
      await loadCompany({ silent: true });
      showClientMutationSuccess(t("clientDetail.noteAdded"));
    } else {
      showClientMutationError(await parseErrorMessage(res, t("clientDetail.couldNotAddNote")));
    }
    setPendingClientAction(null);
  };

  const saveContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingContact?.name.trim()) {
      showClientMutationError(t("clientDetail.contactNameRequired"));
      return;
    }
    setPendingClientAction(`contact:update:${editingContact.id}`);
    setClientMutationError(null);
    const res = await fetch(`/api/companies/${id}/contacts/${editingContact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingContact.name.trim(),
        email: cleanNullable(editingContact.email),
        phone: cleanNullable(editingContact.phone),
        role: cleanNullable(editingContact.role),
      }),
    });
    if (res.ok) {
      setEditingContact(null);
      await loadCompany({ silent: true });
      showClientMutationSuccess(t("clientDetail.contactUpdated"));
    } else {
      showClientMutationError(await parseErrorMessage(res, t("clientDetail.couldNotUpdateContact")));
    }
    setPendingClientAction(null);
  };

  const deleteContact = async (contact: CompanyContact) => {
    if (!window.confirm(t("clientDetail.deleteContactConfirm", { name: contact.name }))) return;
    setPendingClientAction(`contact:delete:${contact.id}`);
    setClientMutationError(null);
    const res = await fetch(`/api/companies/${id}/contacts/${contact.id}`, { method: "DELETE" });
    if (res.ok) {
      await loadCompany({ silent: true });
      showClientMutationSuccess(t("clientDetail.contactDeleted"));
    } else {
      showClientMutationError(await parseErrorMessage(res, t("clientDetail.couldNotDeleteContact")));
    }
    setPendingClientAction(null);
  };

  const saveNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingNote?.body.trim()) {
      showClientMutationError(t("clientDetail.noteRequired"));
      return;
    }
    setPendingClientAction(`note:update:${editingNote.id}`);
    setClientMutationError(null);
    const res = await fetch(`/api/companies/${id}/notes/${editingNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editingNote.body.trim() }),
    });
    if (res.ok) {
      setEditingNote(null);
      await loadCompany({ silent: true });
      showClientMutationSuccess(t("clientDetail.noteUpdated"));
    } else {
      showClientMutationError(await parseErrorMessage(res, t("clientDetail.couldNotUpdateNote")));
    }
    setPendingClientAction(null);
  };

  const deleteNote = async (note: CompanyNote) => {
    if (!window.confirm(t("clientDetail.deleteNoteConfirm"))) return;
    setPendingClientAction(`note:delete:${note.id}`);
    setClientMutationError(null);
    const res = await fetch(`/api/companies/${id}/notes/${note.id}`, { method: "DELETE" });
    if (res.ok) {
      await loadCompany({ silent: true });
      showClientMutationSuccess(t("clientDetail.noteDeleted"));
    } else {
      showClientMutationError(await parseErrorMessage(res, t("clientDetail.couldNotDeleteNote")));
    }
    setPendingClientAction(null);
  };

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPlan(true);
    setPlanError(null);
    const includedServices = planForm.included_services
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    const res = await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_type: cleanNullable(planForm.service_type),
        plan_name: cleanNullable(planForm.plan_name),
        billing_cycle: cleanNullable(planForm.billing_cycle),
        included_services: includedServices.length ? includedServices : null,
        plan_notes: cleanNullable(planForm.plan_notes),
      }),
    });

    if (!res.ok) {
      setSavingPlan(false);
      setPlanError(await parseErrorMessage(res, t("clientDetail.couldNotSavePlan")));
      return;
    }

    const updated = (await res.json()) as Company;
    setCompany((current) => current ? { ...current, ...updated } : current);
    setPlanForm(toPlanForm(updated));
    setEditingPlan(false);
    setSavingPlan(false);
  };

  if (notFoundState) notFound();

  if (loading || !company) {
    return (
      <>
        <Header title={t("clientDetail.title")} />
        <div className="space-y-4 p-4 sm:p-6" role="status" aria-busy="true">
          <div className="h-32 animate-pulse rounded-xl bg-white/5" />
          <div className="grid gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-48 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      </>
    );
  }
  const summary = company.summary;
  const clientHealth = getClientHealth(company, t);

  return (
    <>
      <Header title={company.name} />
      <div className="space-y-6 overflow-x-hidden p-4 sm:p-6">
        <section className="glass rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("clientDetail.title")}</p>
                <h2 className="break-words text-2xl font-bold text-foreground">{company.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {company.commercial_status || company.status}
                  {company.industry ? ` - ${company.industry}` : ""}
                </p>
              </div>
            </div>
            <div className="grid gap-2 text-left text-xs text-muted-foreground sm:text-right">
              <span>{t("clientDetail.contract", { value: money(company.contract_value, locale, t) })}</span>
              <span>{t("clientDetail.commission", { value: money(company.commission, locale, t) })}</span>
              {company.website && (
                <a href={company.website} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  {t("clientDetail.website")}
                </a>
              )}
              <Link
                href={`/clients/${company.id}/report`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-foreground hover:bg-white/5"
              >
                <FileText className="h-4 w-4" />
                {t("clientDetail.reportWorkflow")}
              </Link>
              <button
                type="button"
                onClick={() => setShowProjectDialog(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                {t("clientDetail.newProject")}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="glass rounded-xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {t("clientDetail.snapshot")}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  {t("clientDetail.snapshotTitle")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("clientDetail.snapshotDescription")}
                </p>
              </div>
              <StatusPill status={clientHealth.status} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PlanFact label={t("clientDetail.plan")} value={company.plan_name || t("clientHealth.notSet")} hint={company.service_type || t("clientDetail.serviceTypeNotSet")} />
              <PlanFact
                label={t("clientHealth.nextDeadline")}
                value={summary?.next_deadline ? formatDate(summary.next_deadline, locale) : t("clientDetail.notScheduled")}
                hint={t("clientDetail.deadlineHint")}
              />
              <PlanFact label={t("clientDetail.clientOwner")} value={company.owner?.name ?? t("clientHealth.notAssigned")} hint={company.owner?.email ?? t("clientDetail.assignOwnerHint")} />
              <PlanFact
                label={t("clientDetail.deliveryLoad")}
                value={t("clientDetail.openCount", { count: summary?.open_task_count ?? 0 })}
                hint={t("clientDetail.linkedProjects", { count: summary?.project_count ?? 0 })}
              />
            </div>
          </div>

          <div className="glass rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <AlertCircle className="h-4 w-4 text-upflow-warning" />
              {t("clientDetail.healthTrace")}
            </h3>
            {clientHealth.reasons.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {clientHealth.reasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted-foreground">
                    {reason}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-3 text-xs text-muted-foreground">
                {t("clientDetail.noTraceableHealthIssues")}
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label={t("clientDetail.openWork")}
            value={summary?.open_task_count ?? 0}
            hint={t("clientDetail.overdueCount", { count: summary?.overdue_task_count ?? 0 })}
            icon={<CheckSquare className="h-4 w-4" />}
            danger={(summary?.overdue_task_count ?? 0) > 0}
          />
          <MetricCard
            label={t("clientHealth.trackedTime")}
            value={formatSeconds(summary?.tracked_seconds ?? 0, t)}
            hint={t("clientDetail.linkedProjectTime")}
            icon={<Timer className="h-4 w-4" />}
          />
          <MetricCard
            label={t("clientDetail.contractValue")}
            value={money(company.contract_value, locale, t)}
            hint={t("clientDetail.commission", { value: money(company.commission, locale, t) })}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <MetricCard
            label={t("clientDetail.valuePerHour")}
            value={
              summary?.contract_value_per_tracked_hour != null
                ? money(summary.contract_value_per_tracked_hour, locale, t)
                : t("clientDetail.noTrackedTime")
            }
            hint={
              summary?.commission_per_tracked_hour != null
                ? t("clientDetail.commissionPerHour", { value: money(summary.commission_per_tracked_hour, locale, t) })
                : t("clientDetail.trackTimeHint")
            }
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            label={t("clientDetail.risk")}
            value={summary?.risk_reasons.length ?? 0}
            hint={summary?.risk_reasons[0] ?? t("clientDetail.noCurrentRisk")}
            icon={<AlertCircle className="h-4 w-4" />}
            danger={(summary?.risk_reasons.length ?? 0) > 0}
          />
        </section>

        {summary?.risk_reasons.length ? (
          <section className="rounded-xl border border-upflow-danger/20 bg-upflow-danger/10 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-upflow-danger">
              <AlertCircle className="h-4 w-4" />
              {t("clientDetail.riskChecklist")}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.risk_reasons.map((reason) => (
                <span key={reason} className="rounded-full bg-upflow-danger/15 px-3 py-1 text-xs text-upflow-danger">
                  {reason}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section id="onboarding" className="scroll-mt-24">
          <ClientOnboardingPanel
            companyId={company.id}
            company={company}
            onChanged={() => loadCompany({ silent: true })}
          />
        </section>
        <section className="glass rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PackageCheck className="h-4 w-4" />
                {t("clientDetail.servicesPlan")}
              </h3>
            </div>
            {editingPlan ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPlanForm(toPlanForm(company));
                    setPlanError(null);
                    setEditingPlan(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5"
                >
                  <X className="h-4 w-4" />
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  form="client-plan-form"
                  disabled={savingPlan}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingPlan ? t("docs.saving") : t("clientDetail.savePlan")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingPlan(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-foreground hover:bg-white/5"
              >
                <Pencil className="h-4 w-4" />
                {t("clientDetail.editPlan")}
              </button>
            )}
          </div>

          {editingPlan ? (
            <form id="client-plan-form" onSubmit={savePlan} className="mt-5 grid gap-4 lg:grid-cols-3">
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground">
                {t("clientDetail.serviceType")}
                <input
                  value={planForm.service_type}
                  onChange={(e) => setPlanForm((form) => ({ ...form, service_type: e.target.value }))}
                  placeholder={t("clientDetail.serviceTypePlaceholder")}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                />
              </label>
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground">
                {t("clientDetail.plan")}
                <input
                  value={planForm.plan_name}
                  onChange={(e) => setPlanForm((form) => ({ ...form, plan_name: e.target.value }))}
                  placeholder={t("clientDetail.planPlaceholder")}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                />
              </label>
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground">
                {t("clientDetail.billingCycle")}
                <select
                  value={planForm.billing_cycle}
                  onChange={(e) => setPlanForm((form) => ({ ...form, billing_cycle: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                >
                  <option value="">{t("clientHealth.notSet")}</option>
                  <option value="monthly">{t("clientDetail.monthly")}</option>
                  <option value="quarterly">{t("clientDetail.quarterly")}</option>
                  <option value="annual">{t("clientDetail.annual")}</option>
                  <option value="project">{t("clientDetail.perProject")}</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground lg:col-span-2">
                {t("clientDetail.includedServices")}
                <textarea
                  value={planForm.included_services}
                  onChange={(e) => setPlanForm((form) => ({ ...form, included_services: e.target.value }))}
                  rows={4}
                  placeholder={t("clientDetail.includedServicesPlaceholder")}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                />
              </label>
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground">
                {t("clientDetail.planNotes")}
                <textarea
                  value={planForm.plan_notes}
                  onChange={(e) => setPlanForm((form) => ({ ...form, plan_notes: e.target.value }))}
                  rows={4}
                  placeholder={t("clientDetail.planNotesPlaceholder")}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                />
              </label>
              {planError ? <p className="text-sm text-upflow-danger lg:col-span-3">{planError}</p> : null}
            </form>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_2fr]">
              <PlanFact label={t("clientDetail.serviceType")} value={company.service_type || t("clientHealth.notSet")} />
              <PlanFact label={t("clientDetail.plan")} value={company.plan_name || t("clientHealth.notSet")} hint={formatBillingCycle(company.billing_cycle, t)} />
              <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{t("clientDetail.includedServices")}</p>
                {company.included_services?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {company.included_services.map((service) => (
                      <span key={service} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                        {service}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{t("clientDetail.noServices")}</p>
                )}
                {company.plan_notes ? <p className="mt-4 text-sm text-muted-foreground">{company.plan_notes}</p> : null}
              </div>
            </div>
          )}
        </section>

        <ClientMutationFeedback error={clientMutationError} success={clientMutationSuccess} />

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title={t("clientDetail.contacts")} icon={<Users className="h-4 w-4" />}>
            <form onSubmit={addContact} className="grid gap-2">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t("clientDetail.contactName")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm" />
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder={t("clientDetail.emailAddress")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm" />
              <button
                type="submit"
                disabled={!contactName.trim() || pendingClientAction === "contact:create"}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> {pendingClientAction === "contact:create" ? t("clientDetail.adding") : t("clientDetail.addContact")}
              </button>
            </form>
            <List items={company.contacts ?? []} empty={t("clientDetail.noContacts")} render={(contact: CompanyContact) => (
              editingContact?.id === contact.id ? (
                <form onSubmit={saveContact} className="grid gap-2">
                  <input
                    value={editingContact.name}
                    onChange={(e) => setEditingContact((current) => current ? { ...current, name: e.target.value } : current)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    aria-label={t("clientDetail.contactName")}
                  />
                  <input
                    value={editingContact.email}
                    onChange={(e) => setEditingContact((current) => current ? { ...current, email: e.target.value } : current)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    aria-label={t("clientDetail.contactEmail")}
                    placeholder={t("settings.email")}
                  />
                  <input
                    value={editingContact.phone}
                    onChange={(e) => setEditingContact((current) => current ? { ...current, phone: e.target.value } : current)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    aria-label={t("clientDetail.contactPhone")}
                    placeholder={t("settings.phone")}
                  />
                  <input
                    value={editingContact.role}
                    onChange={(e) => setEditingContact((current) => current ? { ...current, role: e.target.value } : current)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    aria-label={t("clientDetail.contactRole")}
                    placeholder={t("clientDetail.role")}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={pendingClientAction === `contact:update:${contact.id}`}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                    >
                      <Save className="h-3.5 w-3.5" /> {t("common.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingContact(null)}
                      className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      <X className="h-3.5 w-3.5" /> {t("common.cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-foreground">{contact.name}</p>
                    <p className="break-words text-xs text-muted-foreground">{contact.email || contact.phone || t("clientDetail.noContactInfo")}</p>
                    {contact.role ? <p className="mt-1 text-xs text-muted-foreground">{contact.role}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingContact({
                        id: contact.id,
                        name: contact.name,
                        email: contact.email ?? "",
                        phone: contact.phone ?? "",
                        role: contact.role ?? "",
                      })}
                      className="rounded-md border border-white/10 p-1.5 text-muted-foreground hover:text-foreground"
                      aria-label={t("clientDetail.editContact", { name: contact.name })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteContact(contact)}
                      disabled={pendingClientAction === `contact:delete:${contact.id}`}
                      className="rounded-md border border-upflow-danger/20 p-1.5 text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-60"
                      aria-label={t("clientDetail.deleteContact", { name: contact.name })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            )} />
          </Panel>

          <Panel title={t("clientDetail.linkedWork")} icon={<FolderKanban className="h-4 w-4" />}>
            <List items={company.projects ?? []} empty={t("clientDetail.noLinkedProjects")} render={(project) => (
              <Link href={`/projects/${project.id}`} className="block">
                <p className="text-sm font-medium text-foreground">{project.name}</p>
                <p className="text-xs text-muted-foreground">{project.status}</p>
              </Link>
            )} />
            <div className="mt-4 border-t border-white/5 pt-4">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <CheckSquare className="h-3.5 w-3.5" /> {t("clientDetail.tasks")}
              </h4>
              <List items={company.tasks ?? []} empty={t("clientDetail.noLinkedTasks")} render={(task) => (
                <p className="text-sm text-foreground">{task.title}</p>
              )} />
            </div>
          </Panel>

          <Panel title={t("clientDetail.notes")} icon={<FileText className="h-4 w-4" />}>
            <form onSubmit={addNote} className="grid gap-2">
              <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} placeholder={t("clientDetail.addNote")} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm" />
              <button
                type="submit"
                disabled={!noteBody.trim() || pendingClientAction === "note:create"}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> {pendingClientAction === "note:create" ? t("clientDetail.adding") : t("clientDetail.addNote")}
              </button>
            </form>
            <List items={company.notes_log ?? []} empty={t("clientDetail.noNotes")} render={(note: CompanyNote) => (
              editingNote?.id === note.id ? (
                <form onSubmit={saveNote} className="grid gap-2">
                  <textarea
                    value={editingNote.body}
                    onChange={(e) => setEditingNote((current) => current ? { ...current, body: e.target.value } : current)}
                    rows={3}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    aria-label={t("clientDetail.noteText")}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={pendingClientAction === `note:update:${note.id}`}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                    >
                      <Save className="h-3.5 w-3.5" /> {t("common.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingNote(null)}
                      className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs text-muted-foreground"
                    >
                      <X className="h-3.5 w-3.5" /> {t("common.cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm text-foreground">{note.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{note.author?.name ?? t("clientDetail.unknown")} - {formatDate(note.created_at, locale)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingNote({ id: note.id, body: note.body })}
                      className="rounded-md border border-white/10 p-1.5 text-muted-foreground hover:text-foreground"
                      aria-label={t("clientDetail.editNote")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteNote(note)}
                      disabled={pendingClientAction === `note:delete:${note.id}`}
                      className="rounded-md border border-upflow-danger/20 p-1.5 text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-60"
                      aria-label={t("clientDetail.deleteNote")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            )} />
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={t("clientDetail.meetings")} icon={<Calendar className="h-4 w-4" />}>
            <List items={company.calendar_events ?? []} empty={t("clientDetail.noLinkedMeetings")} render={(event) => (
              <div>
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(event.starts_at, locale)}</p>
              </div>
            )} />
          </Panel>
          <Panel title={t("clientDetail.activity")} icon={<RefreshCcw className="h-4 w-4" />}>
            <List items={company.activity_events ?? []} empty={t("clientDetail.noClientActivity")} render={(event) => (
              <div>
                <p className="text-sm font-medium text-foreground">{event.type.replaceAll("_", " ")}</p>
                <p className="text-xs text-muted-foreground">{formatDate(event.created_at, locale)}</p>
              </div>
            )} />
          </Panel>
        </div>
      </div>

      <NewProjectDialog
        open={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        defaultCompanyId={company.id}
        onCreated={() => {
          setShowProjectDialog(false);
          void loadCompany({ silent: true });
        }}
      />
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  danger,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <span className={danger ? "text-upflow-danger" : "text-primary"}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
    </section>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4 glass sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon} {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PlanFact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-3 break-words text-lg font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function StatusPill({ status }: { status: "healthy" | "attention" | "risk" | "not_enough_data" }) {
  const { t } = useLanguage();
  const styles = {
    healthy: "bg-upflow-success/15 text-upflow-success",
    attention: "bg-upflow-warning/15 text-upflow-warning",
    risk: "bg-upflow-danger/15 text-upflow-danger",
    not_enough_data: "bg-white/10 text-muted-foreground",
  };
  const labels = {
    healthy: t("clientHealth.healthy"),
    attention: t("clientHealth.needsAttention"),
    risk: t("clientHealth.atRisk"),
    not_enough_data: t("clientDetail.notEnoughData"),
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function List<T extends { id?: string }>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => React.ReactNode }) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-4 text-center text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="min-w-0 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
          {render(item)}
        </div>
      ))}
    </div>
  );
}

function ClientMutationFeedback({ error, success }: { error: string | null; success: string | null }) {
  if (!error && !success) return null;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        error
          ? "border-upflow-danger/25 bg-upflow-danger/10 text-upflow-danger"
          : "border-upflow-success/25 bg-upflow-success/10 text-upflow-success"
      }`}
      role={error ? "alert" : "status"}
    >
      {error || success}
    </div>
  );
}

function toPlanForm(company: Pick<Company, "service_type" | "plan_name" | "billing_cycle" | "included_services" | "plan_notes">) {
  return {
    service_type: company.service_type ?? "",
    plan_name: company.plan_name ?? "",
    billing_cycle: company.billing_cycle ?? "",
    included_services: Array.isArray(company.included_services) ? company.included_services.join("\n") : "",
    plan_notes: company.plan_notes ?? "",
  };
}

function cleanNullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function formatBillingCycle(
  value: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (!value) return t("clientDetail.billingCycleNotSet");
  const labels: Record<string, string> = {
    monthly: "clientDetail.monthly",
    quarterly: "clientDetail.quarterly",
    annual: "clientDetail.annual",
    project: "clientDetail.perProject",
  };
  return labels[value] ? t(labels[value]) : value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function money(
  value: number | null,
  locale: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (value == null) return t("clientHealth.notSet");
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(value);
}

function formatSeconds(
  totalSeconds: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return t("clientDetail.hoursMinutes", { hours, minutes });
  return t("clientDetail.minutes", { minutes });
}

function getClientHealth(
  company: ClientPayload,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const reasons = company.summary?.risk_reasons ?? [];
  const hasAnyClientOpsData = Boolean(
    company.plan_name ||
      company.service_type ||
      company.contract_value != null ||
      (company.contacts?.length ?? 0) > 0 ||
      (company.projects?.length ?? 0) > 0 ||
      (company.activity_events?.length ?? 0) > 0,
  );

  if (!hasAnyClientOpsData) {
    return { status: "not_enough_data" as const, reasons: [t("clientDetail.addDataHealthHint")] };
  }
  if ((company.summary?.overdue_task_count ?? 0) > 0) {
    return { status: "risk" as const, reasons };
  }
  if (reasons.length > 0) {
    return { status: "attention" as const, reasons };
  }
  return { status: "healthy" as const, reasons: [] };
}
