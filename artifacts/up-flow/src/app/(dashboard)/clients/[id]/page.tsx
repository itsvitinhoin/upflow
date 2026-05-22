"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Building2, Calendar, CheckSquare, DollarSign, FileText, FolderKanban, Plus, RefreshCcw, Timer, Users } from "lucide-react";
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

  const loadCompany = async () => {
    setLoading(true);
    const res = await fetch(`/api/companies/${id}`);
    if (res.status === 404) {
      setNotFoundState(true);
      return;
    }
    setCompany((await res.json()) as ClientPayload);
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

  if (notFoundState) notFound();

  if (loading || !company) {
    return (
      <>
        <Header title="Client" />
        <div className="p-6 space-y-4" role="status" aria-busy="true">
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

  return (
    <>
      <Header title={company.name} />
      <div className="p-6 space-y-6">
        <section className="glass rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Client</p>
                <h2 className="text-2xl font-bold text-foreground">{company.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {company.commercial_status || company.status}
                  {company.industry ? ` · ${company.industry}` : ""}
                </p>
              </div>
            </div>
            <div className="grid gap-2 text-right text-xs text-muted-foreground">
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
                <p className="mt-1 text-xs text-muted-foreground">{note.author?.name ?? "Unknown"} · {formatDate(note.created_at)}</p>
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
    <section className="glass rounded-xl p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon} {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function List<T extends { id?: string }>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => React.ReactNode }) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-4 text-center text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
          {render(item)}
        </div>
      ))}
    </div>
  );
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
