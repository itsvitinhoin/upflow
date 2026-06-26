"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Clock3,
  Database,
  Filter,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Header from "@/components/layout/header";
import type { ActivityEvent } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const ENTITY_OPTIONS = [
  ["", "All records"],
  ["workspace", "Workspace"],
  ["workspace_member", "Roles and access"],
  ["invite", "Invites"],
  ["space", "Spaces"],
  ["folder", "Folders"],
  ["list", "Lists"],
  ["project", "Projects"],
  ["task", "Tasks"],
  ["company", "Clients"],
  ["contact", "Contacts"],
  ["note", "Notes"],
  ["time_entry", "Time"],
] as const;

export default function ActivityAuditPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadActivity = useCallback(async (cursor?: string | null) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "75" });
      if (query.trim()) params.set("q", query.trim());
      if (entityType) params.set("entity_type", entityType);
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/activity?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        items?: ActivityEvent[];
        nextCursor?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || `Could not load activity (${res.status})`);
      setEvents((current) => (cursor ? [...current, ...(data.items ?? [])] : data.items ?? []));
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity");
    } finally {
      setLoading(false);
    }
  }, [entityType, query]);

  useEffect(() => {
    loadActivity(null);
  }, [loadActivity]);

  const summary = useMemo(() => {
    const accessEvents = events.filter((event) =>
      /invite|member|role|permission|workspace/i.test(`${event.entity_type} ${event.type}`),
    ).length;
    const destructiveEvents = events.filter((event) => /delete|remove|deactivate/i.test(event.type)).length;
    const clientEvents = events.filter((event) => event.company_id || event.entity_type === "company").length;
    return { accessEvents, destructiveEvents, clientEvents };
  }, [events]);

  return (
    <>
      <Header title="Activity" />
      <main className="space-y-5 p-4 sm:p-6">
        <section className="rounded-2xl border border-blue-400/20 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_34%),rgba(2,6,23,0.74)] p-5 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Audit center
              </div>
              <h1 className="mt-4 text-2xl font-bold text-white">Activity and audit log</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Review who changed what across clients, projects, tasks, roles, invites, permissions, and workspace-level actions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadActivity(null)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-white/[0.07]"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <AuditStat icon={<ShieldCheck className="h-4 w-4" />} label="Access changes" value={summary.accessEvents} tone="info" />
            <AuditStat icon={<AlertTriangle className="h-4 w-4" />} label="Deleted or removed" value={summary.destructiveEvents} tone="danger" />
            <AuditStat icon={<Building2 className="h-4 w-4" />} label="Client history" value={summary.clientEvents} tone="success" />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-background/60 px-3 text-sm text-muted-foreground">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadActivity(null);
                }}
                placeholder="Search type, actor, client, or record id..."
                className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-background/60 px-3 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <select
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
                className="bg-transparent text-foreground outline-none"
              >
                {ENTITY_OPTIONS.map(([value, label]) => (
                  <option key={value || "all"} value={value} className="bg-[#07101f] text-foreground">
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => loadActivity(null)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">{error}</section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#07101f]/86">
            <div className="grid grid-cols-[1.1fr_0.9fr_0.9fr_1fr_1.4fr] gap-4 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-blue-100/50 max-xl:hidden">
              <span>Event</span>
              <span>Actor</span>
              <span>Client</span>
              <span>When</span>
              <span>Metadata</span>
            </div>
            <div className="divide-y divide-white/10">
              {loading && events.length === 0 ? (
                [1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse bg-white/[0.025]" />)
              ) : events.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No matching audit events.</div>
              ) : (
                events.map((event) => <AuditRow key={event.id} event={event} />)
              )}
            </div>
            {nextCursor ? (
              <div className="border-t border-white/10 p-3 text-center">
                <button
                  type="button"
                  onClick={() => loadActivity(nextCursor)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-white/[0.07]"
                >
                  Load more
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </>
  );
}

function AuditRow({ event }: { event: ActivityEvent }) {
  const actor = event.actor?.name || event.actor?.email || "System";
  const metadata = event.metadata ? JSON.stringify(event.metadata) : "No metadata";
  return (
    <article className="grid gap-3 px-4 py-4 text-sm text-blue-50/85 xl:grid-cols-[1.1fr_0.9fr_0.9fr_1fr_1.4fr] xl:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-200">
            <Activity className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{humanize(event.type)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {event.entity_type}
              {event.entity_id ? ` · ${event.entity_id}` : ""}
            </p>
          </div>
        </div>
      </div>
      <InlineField icon={<UserRound className="h-4 w-4" />} label="Actor" value={actor} />
      <div className="min-w-0">
        {event.company ? (
          <Link href={`/clients/${event.company.id}`} className="inline-flex min-w-0 items-center gap-2 text-blue-100 hover:text-white">
            <Building2 className="h-4 w-4 shrink-0 text-blue-300" />
            <span className="truncate">{event.company.name}</span>
          </Link>
        ) : (
          <InlineField icon={<Building2 className="h-4 w-4" />} label="Client" value="Not linked" />
        )}
      </div>
      <InlineField icon={<Clock3 className="h-4 w-4" />} label="When" value={formatDate(event.created_at)} />
      <InlineField icon={<Database className="h-4 w-4" />} label="Metadata" value={metadata} mono />
    </article>
  );
}

function AuditStat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: "info" | "danger" | "success" }) {
  const toneClass = {
    info: "border-blue-400/20 bg-blue-500/10 text-blue-200",
    danger: "border-rose-400/20 bg-rose-500/10 text-rose-200",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3", toneClass)}>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.12em] opacity-80">
        <span>{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function InlineField({ icon, label, value, mono = false }: { icon: ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-100/45 xl:hidden">
        {icon}
        {label}
      </p>
      <p className={cn("truncate text-sm text-blue-50/80", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
