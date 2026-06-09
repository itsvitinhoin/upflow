"use client";

import Link from "next/link";
import { AlertCircle, TrendingDown, Users2 } from "lucide-react";
import type { Project, Task } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type AgencyDrawer =
  | "client_health"
  | "delivery_overview"
  | "creative_queue"
  | "department_workload"
  | "agency_risk_signals";

type CreativeStage =
  | "waiting_for_briefing"
  | "ready_to_start"
  | "in_production"
  | "waiting_for_approval"
  | "revision_requested";

interface AgencyOperationsData {
  client_health?: {
    counts: {
      healthy: number;
      attention_needed: number;
      at_risk: number;
      not_enough_data: number;
    };
  };
  delivery_overview?: {
    items: Array<{
      project: Pick<Project, "id" | "name"> & {
        company?: { id: string; name: string } | null;
        space?: { id: string; name: string; icon: string | null } | null;
      };
      progress: number;
      next_deadline: string | null;
    }>;
  };
  creative_queue?: {
    items: Array<{ task: Task; stage: CreativeStage }>;
  };
  agency_risk_signals?: {
    items: Array<{
      key: string;
      label: string;
      count: number;
      trace: string;
    }>;
  };
}

export default function AgencyOperationsPanel({
  data,
  onOpenDrawer,
  onOpenTask,
}: {
  data: AgencyOperationsData;
  onOpenDrawer: (drawer: AgencyDrawer) => void;
  onOpenTask: (task: Task) => void;
}) {
  const clientHealth = data.client_health;
  const deliveryItems = data.delivery_overview?.items ?? [];
  const creativeQueue = data.creative_queue;
  const riskSignals = data.agency_risk_signals?.items ?? [];
  const topRisks = riskSignals.filter((signal) => signal.count > 0).slice(0, 3);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
      <div className="glass relative overflow-hidden rounded-2xl p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-upflow-success via-primary to-upflow-warning" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Agency operations
            </p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">
              Client work, delivery, creative queue, and workload
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Built from real clients, campaigns, deliverables, deadlines, owners, activity, and time records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenDrawer("agency_risk_signals")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/50 hover:bg-primary/10"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Trace risks
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <AgencyMiniCard
            title="Client health"
            value={clientHealth ? `${clientHealth.counts.healthy} healthy` : "Not enough data"}
            hint={
              clientHealth
                ? `${clientHealth.counts.attention_needed + clientHealth.counts.at_risk} need attention`
                : "Add clients, projects, contacts, and activity"
            }
            onClick={() => onOpenDrawer("client_health")}
          />
          <AgencyMiniCard
            title="Campaign delivery"
            value={`${deliveryItems.length} active`}
            hint={deliveryItems.length ? "Progress and next deadlines" : "No active client work yet"}
            onClick={() => onOpenDrawer("delivery_overview")}
          />
          <AgencyMiniCard
            title="Creative queue"
            value={`${creativeQueue?.items.length ?? 0} deliverables`}
            hint={creativeQueue?.items.length ? "Briefing, production, approval signals" : "No creative tasks matched yet"}
            onClick={() => onOpenDrawer("creative_queue")}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-foreground">Closest delivery deadlines</h4>
              <button
                type="button"
                onClick={() => onOpenDrawer("delivery_overview")}
                className="text-xs text-primary hover:text-primary/80"
              >
                View all
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {deliveryItems.length === 0 ? (
                <p className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-3 text-xs text-muted-foreground">
                  No active client work yet. Apply an agency template or create a client campaign.
                </p>
              ) : (
                deliveryItems.slice(0, 4).map((item) => (
                  <Link
                    key={item.project.id}
                    href={`/projects/${item.project.id}`}
                    className="block rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">{item.project.name}</p>
                      <span className="text-xs font-semibold text-foreground">{item.progress}%</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.project.company?.name ?? item.project.space?.name ?? "Internal work"}
                      {item.next_deadline ? ` - ${formatDate(item.next_deadline)}` : " - No deadline"}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-foreground">Creative production queue</h4>
              <button
                type="button"
                onClick={() => onOpenDrawer("creative_queue")}
                className="text-xs text-primary hover:text-primary/80"
              >
                View queue
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {!creativeQueue?.items.length ? (
                <p className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-3 text-xs text-muted-foreground">
                  No creative/content deliverables matched yet. Use Creative, Production, or Marketing templates to populate this queue.
                </p>
              ) : (
                creativeQueue.items.slice(0, 4).map(({ task, stage }) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task)}
                    className="w-full rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium text-foreground">{task.title}</p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {creativeStageLabel(stage)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {task.project?.name ?? "No project"}{task.due_date ? ` - ${formatDate(task.due_date)}` : ""}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Agency risk signals</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Only traceable signals from tasks, clients, projects, owners, and activity.
            </p>
          </div>
          <TrendingDown className="h-5 w-5 text-upflow-warning" />
        </div>
        <div className="mt-4 space-y-2">
          {topRisks.length === 0 ? (
            <p className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3 text-xs text-muted-foreground">
              Not enough risk data yet, or no current operational risks were detected from real records.
            </p>
          ) : (
            topRisks.map((signal) => (
              <button
                key={signal.key}
                type="button"
                onClick={() => onOpenDrawer("agency_risk_signals")}
                className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3 text-left hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">{signal.label}</span>
                  <span className="text-lg font-bold text-upflow-warning">{signal.count}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{signal.trace}</p>
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenDrawer("department_workload")}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/50 hover:bg-primary/10"
        >
          <Users2 className="h-3.5 w-3.5" />
          Workload by department
        </button>
      </aside>
    </section>
  );
}

function AgencyMiniCard({
  title,
  value,
  hint,
  onClick,
}: {
  title: string;
  value: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/10"
    >
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}

function creativeStageLabel(stage: CreativeStage) {
  const labels: Record<CreativeStage, string> = {
    waiting_for_briefing: "Briefing",
    ready_to_start: "Ready",
    in_production: "Production",
    waiting_for_approval: "Approval",
    revision_requested: "Revision",
  };
  return labels[stage];
}
