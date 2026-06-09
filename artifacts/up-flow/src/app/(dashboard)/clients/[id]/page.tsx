"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Building2, Calendar, CheckSquare, DollarSign, FileText, FolderKanban, PackageCheck, Pencil, Plus, RefreshCcw, Save, Timer, Users, X } from "lucide-react";
import Header from "@/components/layout/header";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import type { Company, CompanyContact, CompanyNote, TimeEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type ClientPayload = Company & { time_entries?: TimeEntry[] };

export default function ClientDetailPage() {
  const params = useParams();
  const id = (params?.id ?? "") as string;
  const [company, setCompany] = useState<ClientPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [noteBody, setNoteBody] = useState("");
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

  const loadCompany = async () => {
    setLoading(true);
    const res = await fetch(`/api/companies/${id}`);
    if (res.status === 404) {
      setNotFoundState(true);
      return;
    }
    const payload = (await res.json()) as ClientPayload;
    setCompany(payload);
    setPlanForm(toPlanForm(payload));
    setLoading(false);
  };

  useEffect(() => {
    if (id) loadCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contactName.trim()) return;
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
      loadCompany();
    }
  };

  const addNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteBody.trim()) return;
    const res = await fetch(`/api/companies/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: noteBody.trim() }),
    });
    if (res.ok) {
      setNoteBody("");
      loadCompany();
    }
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
      setPlanError("Could not save service plan. Try again.");
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
        <Header title="Client" />
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
  const clientHealth = getClientHealth(company);

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
                <p className="text-xs text-muted-foreground">Client</p>
                <h2 className="break-words text-2xl font-bold text-foreground">{company.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {company.commercial_status || company.status}
                  {company.industry ? ` - ${company.industry}` : ""}
                </p>
              </div>
            </div>
            <div className="grid gap-2 text-left text-xs text-muted-foreground sm:text-right">
              <span>Contract: {money(company.contract_value)}</span>
              <span>Commission: {money(company.commission)}</span>
              {company.website && (
                <a href={company.website} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  Website
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowProjectDialog(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New project
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="glass rounded-xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Client operations snapshot
                </p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  Plan, delivery, deadline, and owner context
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Built only from linked projects, tasks, contacts, activity, and commercial fields.
                </p>
              </div>
              <StatusPill status={clientHealth.status} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <PlanFact label="Plan" value={company.plan_name || "Not set"} hint={company.service_type || "Service type not set"} />
              <PlanFact
                label="Next deadline"
                value={summary?.next_deadline ? formatDate(summary.next_deadline) : "Not scheduled"}
                hint="From linked project or open task due dates"
              />
              <PlanFact label="Client owner" value={company.owner?.name ?? "Not assigned"} hint={company.owner?.email ?? "Assign owner for accountability"} />
              <PlanFact
                label="Delivery load"
                value={`${summary?.open_task_count ?? 0} open`}
                hint={`${summary?.project_count ?? 0} linked projects`}
              />
            </div>
          </div>

          <div className="glass rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <AlertCircle className="h-4 w-4 text-upflow-warning" />
              Health trace
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
                No traceable client health issues from current records.
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Open work"
            value={summary?.open_task_count ?? 0}
            hint={`${summary?.overdue_task_count ?? 0} overdue`}
            icon={<CheckSquare className="h-4 w-4" />}
            danger={(summary?.overdue_task_count ?? 0) > 0}
          />
          <MetricCard
            label="Tracked time"
            value={formatSeconds(summary?.tracked_seconds ?? 0)}
            hint="Across linked projects"
            icon={<Timer className="h-4 w-4" />}
          />
          <MetricCard
            label="Contract value"
            value={money(company.contract_value)}
            hint={`Commission ${money(company.commission)}`}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <MetricCard
            label="Risk"
            value={summary?.risk_reasons.length ?? 0}
            hint={summary?.risk_reasons[0] ?? "No current client risk"}
            icon={<AlertCircle className="h-4 w-4" />}
            danger={(summary?.risk_reasons.length ?? 0) > 0}
          />
        </section>

        {summary?.risk_reasons.length ? (
          <section className="rounded-xl border border-upflow-danger/20 bg-upflow-danger/10 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-upflow-danger">
              <AlertCircle className="h-4 w-4" />
              Client risk checklist
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

        <section className="glass rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PackageCheck className="h-4 w-4" />
                Services and plan
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
                  Cancel
                </button>
                <button
                  type="submit"
                  form="client-plan-form"
                  disabled={savingPlan}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingPlan ? "Saving..." : "Save plan"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingPlan(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-foreground hover:bg-white/5"
              >
                <Pencil className="h-4 w-4" />
                Edit plan
              </button>
            )}
          </div>

          {editingPlan ? (
            <form id="client-plan-form" onSubmit={savePlan} className="mt-5 grid gap-4 lg:grid-cols-3">
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground">
                Service type
                <input
                  value={planForm.service_type}
                  onChange={(e) => setPlanForm((form) => ({ ...form, service_type: e.target.value }))}
                  placeholder="Paid media, SEO, content..."
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                />
              </label>
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground">
                Plan
                <input
                  value={planForm.plan_name}
                  onChange={(e) => setPlanForm((form) => ({ ...form, plan_name: e.target.value }))}
                  placeholder="Starter, Growth, Premium..."
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                />
              </label>
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground">
                Billing cycle
                <select
                  value={planForm.billing_cycle}
                  onChange={(e) => setPlanForm((form) => ({ ...form, billing_cycle: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                >
                  <option value="">Not set</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="project">Per project</option>
                </select>
              </label>
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground lg:col-span-2">
                Included services
                <textarea
                  value={planForm.included_services}
                  onChange={(e) => setPlanForm((form) => ({ ...form, included_services: e.target.value }))}
                  rows={4}
                  placeholder={"Meta Ads management\nCreative approvals\nMonthly performance report"}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                />
              </label>
              <label className="grid gap-2 text-xs font-medium uppercase text-muted-foreground">
                Plan notes
                <textarea
                  value={planForm.plan_notes}
                  onChange={(e) => setPlanForm((form) => ({ ...form, plan_notes: e.target.value }))}
                  rows={4}
                  placeholder="Limits, add-ons, renewal terms..."
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm normal-case text-foreground"
                />
              </label>
              {planError ? <p className="text-sm text-upflow-danger lg:col-span-3">{planError}</p> : null}
            </form>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_2fr]">
              <PlanFact label="Service type" value={company.service_type || "Not set"} />
              <PlanFact label="Plan" value={company.plan_name || "Not set"} hint={formatBillingCycle(company.billing_cycle)} />
              <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Included services</p>
                {company.included_services?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {company.included_services.map((service) => (
                      <span key={service} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                        {service}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No services listed yet</p>
                )}
                {company.plan_notes ? <p className="mt-4 text-sm text-muted-foreground">{company.plan_notes}</p> : null}
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Contacts" icon={<Users className="h-4 w-4" />}>
            <form onSubmit={addContact} className="grid gap-2">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm" />
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm" />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                <Plus className="h-4 w-4" /> Add contact
              </button>
            </form>
            <List items={company.contacts ?? []} empty="No contacts yet" render={(contact: CompanyContact) => (
              <div>
                <p className="text-sm font-medium text-foreground">{contact.name}</p>
                <p className="text-xs text-muted-foreground">{contact.email || contact.phone || "No contact info"}</p>
              </div>
            )} />
          </Panel>

          <Panel title="Linked work" icon={<FolderKanban className="h-4 w-4" />}>
            <List items={company.projects ?? []} empty="No linked projects" render={(project) => (
              <Link href={`/projects/${project.id}`} className="block">
                <p className="text-sm font-medium text-foreground">{project.name}</p>
                <p className="text-xs text-muted-foreground">{project.status}</p>
              </Link>
            )} />
            <div className="mt-4 border-t border-white/5 pt-4">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <CheckSquare className="h-3.5 w-3.5" /> Tasks
              </h4>
              <List items={company.tasks ?? []} empty="No linked tasks" render={(task) => (
                <p className="text-sm text-foreground">{task.title}</p>
              )} />
            </div>
          </Panel>

          <Panel title="Notes" icon={<FileText className="h-4 w-4" />}>
            <form onSubmit={addNote} className="grid gap-2">
              <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} placeholder="Add a note" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm" />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                <Plus className="h-4 w-4" /> Add note
              </button>
            </form>
            <List items={company.notes_log ?? []} empty="No notes yet" render={(note: CompanyNote) => (
              <div>
                <p className="text-sm text-foreground">{note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note.author?.name ?? "Unknown"} - {formatDate(note.created_at)}</p>
              </div>
            )} />
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Meetings" icon={<Calendar className="h-4 w-4" />}>
            <List items={company.calendar_events ?? []} empty="No linked meetings" render={(event) => (
              <div>
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(event.starts_at)}</p>
              </div>
            )} />
          </Panel>
          <Panel title="Activity" icon={<RefreshCcw className="h-4 w-4" />}>
            <List items={company.activity_events ?? []} empty="No client activity" render={(event) => (
              <div>
                <p className="text-sm font-medium text-foreground">{event.type.replaceAll("_", " ")}</p>
                <p className="text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
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
          loadCompany();
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
  const styles = {
    healthy: "bg-upflow-success/15 text-upflow-success",
    attention: "bg-upflow-warning/15 text-upflow-warning",
    risk: "bg-upflow-danger/15 text-upflow-danger",
    not_enough_data: "bg-white/10 text-muted-foreground",
  };
  const labels = {
    healthy: "Healthy",
    attention: "Needs attention",
    risk: "At risk",
    not_enough_data: "Not enough data",
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

function formatBillingCycle(value: string | null) {
  if (!value) return "Billing cycle not set";
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function money(value: number | null) {
  if (value == null) return "Not set";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function formatSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getClientHealth(company: ClientPayload) {
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
    return { status: "not_enough_data" as const, reasons: ["Add plan, contacts, linked work, or activity"] };
  }
  if ((company.summary?.overdue_task_count ?? 0) > 0) {
    return { status: "risk" as const, reasons };
  }
  if (reasons.length > 0) {
    return { status: "attention" as const, reasons };
  }
  return { status: "healthy" as const, reasons: [] };
}
