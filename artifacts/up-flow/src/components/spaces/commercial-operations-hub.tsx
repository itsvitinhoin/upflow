"use client";

import {
  Activity,
  ArrowRight,
  Calendar,
  CheckCircle2,
  DollarSign,
  Filter,
  Plus,
  Target,
  Trophy,
  Users2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ActivityEvent, Project, Task, TeamMember } from "@/lib/types";
import { cn, formatDate, priorityColor } from "@/lib/utils";
import type { SpaceDashboardData } from "@/components/spaces/space-page-types";
import {
  formatDateTime,
  formatSecondsShort,
  humanize,
  type DrawerKind,
  type TaskStatus,
} from "@/components/spaces/space-dashboard-utils";

type CommercialOperationsHubProps = {
  data: SpaceDashboardData;
  updatingTask: boolean;
  onOpenDrawer: (kind: DrawerKind) => void;
  onCreateTask: () => void;
  onTaskStatusChange: (task: Task, status: TaskStatus) => void;
};

type MetricTone = "violet" | "blue" | "green" | "amber" | "cyan" | "rose";

const metricToneStyles: Record<
  MetricTone,
  {
    border: string;
    glow: string;
    icon: string;
    text: string;
    line: string;
  }
> = {
  violet: {
    border: "border-violet-400/25",
    glow: "from-violet-500/20",
    icon: "bg-violet-500/20 text-violet-200",
    text: "text-violet-200",
    line: "stroke-violet-400",
  },
  blue: {
    border: "border-blue-400/25",
    glow: "from-blue-500/20",
    icon: "bg-blue-500/20 text-blue-200",
    text: "text-blue-200",
    line: "stroke-blue-400",
  },
  green: {
    border: "border-emerald-400/25",
    glow: "from-emerald-500/20",
    icon: "bg-emerald-500/20 text-emerald-200",
    text: "text-emerald-200",
    line: "stroke-emerald-400",
  },
  amber: {
    border: "border-amber-400/25",
    glow: "from-amber-500/20",
    icon: "bg-amber-500/20 text-amber-200",
    text: "text-amber-200",
    line: "stroke-amber-400",
  },
  cyan: {
    border: "border-cyan-400/25",
    glow: "from-cyan-500/20",
    icon: "bg-cyan-500/20 text-cyan-200",
    text: "text-cyan-200",
    line: "stroke-cyan-400",
  },
  rose: {
    border: "border-rose-400/25",
    glow: "from-rose-500/20",
    icon: "bg-rose-500/20 text-rose-200",
    text: "text-rose-200",
    line: "stroke-rose-400",
  },
};

const stageTones: MetricTone[] = ["violet", "blue", "green", "amber", "rose"];

export function CommercialOperationsHub({
  data,
  updatingTask,
  onOpenDrawer,
  onCreateTask,
  onTaskStatusChange,
}: CommercialOperationsHubProps) {
  const tasks = data.tasks.items;
  const projects = data.projects.items;
  const command = data.command_center;

  const openTasks = tasks.filter((task) => task.status !== "done");
  const todoTasks = tasks.filter((task) => task.status === "todo");
  const inProgressTasks = tasks.filter((task) => task.status === "in_progress");
  const doneTasks = tasks.filter((task) => task.status === "done");
  const todayTasks = openTasks.filter((task) => isToday(task.due_date));
  const overdueTasks = openTasks.filter((task) => isOverdue(task.due_date));
  const highPriorityOpen = openTasks.filter((task) => task.priority === "high");
  const pipelineValue = projects.reduce((sum, project) => sum + projectValue(project), 0);
  const avgDealSize = projects.length ? pipelineValue / projects.length : 0;
  const winRate = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
  const completionRate = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
  const status =
    command.projects_at_risk.count > 0 || command.urgent_actions.count > 0
      ? "Needs attention"
      : "Operational";
  const stages = buildStages(projects, tasks);
  const topProjects = [...projects]
    .sort((a, b) => {
      const valueDiff = projectValue(b) - projectValue(a);
      if (valueDiff !== 0) return valueDiff;
      return (b._count?.tasks ?? 0) - (a._count?.tasks ?? 0);
    })
    .slice(0, 5);
  const upcomingTasks = [...openTasks]
    .sort((a, b) => {
      const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 5);
  const workload = [...command.team_workload.items]
    .sort((a, b) => {
      const riskDiff = b.overdue_tasks - a.overdue_tasks;
      if (riskDiff !== 0) return riskDiff;
      const taskDiff = b.open_tasks - a.open_tasks;
      if (taskDiff !== 0) return taskDiff;
      return b.tracked_seconds_today - a.tracked_seconds_today;
    })
    .slice(0, 5);

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-[#050816] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-4">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.26),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(4,8,20,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-200">
                Commercial dashboard
              </span>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold",
                  status === "Operational"
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                    : "border-amber-400/25 bg-amber-500/10 text-amber-200",
                )}
              >
                {status}
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Commercial Operations Hub 🚀
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Real-time Comercial Space view of linked clients, active projects, assigned
              work, meetings, tracked time, and operational priorities.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <CommercialToolbarButton icon={<Calendar className="h-4 w-4" />}>
              Last 7 days
            </CommercialToolbarButton>
            <CommercialToolbarButton
              icon={<Filter className="h-4 w-4" />}
              onClick={() => onOpenDrawer("projects_at_risk")}
            >
              Filters
            </CommercialToolbarButton>
            <button
              type="button"
              onClick={onCreateTask}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,70,229,0.35)] transition hover:scale-[1.01] hover:shadow-[0_14px_36px_rgba(79,70,229,0.48)]"
            >
              <Plus className="h-4 w-4" />
              New task
            </button>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
          <CommercialMetricCard
            title="Pipeline value"
            value={pipelineValue > 0 ? formatMoney(pipelineValue) : "Not set"}
            detail="Linked client contract value"
            tone="violet"
            icon={<DollarSign className="h-4 w-4" />}
            sparkSeed={Math.max(1, pipelineValue)}
          />
          <CommercialMetricCard
            title="Active projects"
            value={projects.length}
            detail="Projects in Comercial"
            tone="blue"
            icon={<Target className="h-4 w-4" />}
            sparkSeed={projects.length}
            onClick={() => onOpenDrawer("projects_at_risk")}
          />
          <CommercialMetricCard
            title="Completed work"
            value={doneTasks.length}
            detail="Done tasks in Comercial"
            tone="green"
            icon={<Trophy className="h-4 w-4" />}
            sparkSeed={doneTasks.length}
            onClick={() => onOpenDrawer("status:done")}
          />
          <CommercialMetricCard
            title="Completion rate"
            value={`${completionRate}%`}
            detail={`${doneTasks.length} of ${tasks.length} tasks done`}
            tone="amber"
            icon={<CheckCircle2 className="h-4 w-4" />}
            sparkSeed={completionRate}
            onClick={() => onOpenDrawer("status:done")}
          />
          <CommercialMetricCard
            title="Avg project value"
            value={avgDealSize > 0 ? formatMoney(avgDealSize) : "Not set"}
            detail="Value divided by projects"
            tone="cyan"
            icon={<Activity className="h-4 w-4" />}
            sparkSeed={Math.max(1, avgDealSize)}
          />
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
          <Panel title="Pipeline stage" action="View source" onAction={() => onOpenDrawer("status:todo")}>
            <div className="grid gap-5 md:grid-cols-[0.9fr_1fr]">
              <div className="space-y-2">
                {stages.map((stage, index) => {
                  const width = `${Math.max(52, 100 - index * 11)}%`;
                  const tone = metricToneStyles[stageTones[index] ?? "violet"];
                  return (
                    <button
                      key={stage.name}
                      type="button"
                      onClick={() =>
                        onOpenDrawer(stage.status === "done" ? "status:done" : "status:todo")
                      }
                      className={cn(
                        "flex h-11 items-center justify-between rounded-md border px-3 text-left text-sm font-semibold text-white shadow-inner transition hover:translate-x-1",
                        tone.border,
                        `bg-gradient-to-r ${tone.glow} to-transparent`,
                      )}
                      style={{ width }}
                    >
                      <span>{stage.name}</span>
                      <span>{stage.count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <div className="grid grid-cols-[1fr_64px_86px] border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span>Stage</span>
                  <span className="text-right">Items</span>
                  <span className="text-right">Value</span>
                </div>
                {stages.map((stage) => (
                  <div
                    key={stage.name}
                    className="grid grid-cols-[1fr_64px_86px] items-center border-b border-white/5 px-3 py-3 text-sm last:border-0"
                  >
                    <span className="font-medium text-slate-200">{stage.name}</span>
                    <span className="text-right text-slate-300">{stage.count}</span>
                    <span className="text-right text-slate-300">
                      {stage.value > 0 ? formatMoney(stage.value) : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Commercial value sources" action="View projects" onAction={() => onOpenDrawer("projects_at_risk")}>
            <div className="flex h-full min-h-[220px] flex-col justify-between">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Contract value
                    </p>
                    <p className="mt-2 text-3xl font-bold text-white">
                      {pipelineValue > 0 ? formatMoney(pipelineValue) : "Not set"}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-violet-300" />
                </div>
                <SparkLine tone="violet" seed={Math.max(1, pipelineValue)} height={76} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                This panel only uses real linked company contract values. Add contract values
                on client records to activate revenue-style Comercial reporting.
              </p>
            </div>
          </Panel>
        </div>

        <Panel title="Today's pulse" icon={<Activity className="h-4 w-4 text-violet-300" />}>
          <div className="space-y-2">
            <PulseButton
              label="Urgent actions"
              value={command.urgent_actions.count}
              tone="rose"
              onClick={() => onOpenDrawer("urgent_actions")}
            />
            <PulseButton
              label="Meetings today"
              value={command.meetings_today.count}
              tone="blue"
              onClick={() => onOpenDrawer("meetings_today")}
            />
            <PulseButton
              label="Tasks due today"
              value={todayTasks.length}
              tone="amber"
              onClick={() => onOpenDrawer("status:todo")}
            />
            <PulseButton
              label="Time tracked"
              value={formatSecondsShort(command.time_today.total_seconds)}
              tone="green"
              onClick={() => onOpenDrawer("time_today")}
            />
          </div>
          <button
            type="button"
            onClick={() => onOpenDrawer("urgent_actions")}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-violet-200 hover:text-white"
          >
            View my day
            <ArrowRight className="h-4 w-4" />
          </button>
        </Panel>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Recent activity" action="View all" onAction={() => onOpenDrawer("recent_activity")}>
            <ActivityList items={command.recent_activity.items.slice(0, 5)} />
          </Panel>
          <Panel title="Upcoming tasks" action="View all" onAction={() => onOpenDrawer("urgent_actions")}>
            <TaskList
              tasks={upcomingTasks}
              updatingTask={updatingTask}
              onTaskStatusChange={onTaskStatusChange}
            />
          </Panel>
        </div>

        <div className="grid gap-3">
          <Panel title="Top Comercial projects" action="View all" onAction={() => onOpenDrawer("projects_at_risk")}>
            <TopProjects projects={topProjects} maxValue={Math.max(...topProjects.map(projectValue), 1)} />
          </Panel>
          <Panel title="Team performance" action="View workload" onAction={() => onOpenDrawer("team_workload")}>
            <TeamPerformance items={workload} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MiniStatusCard
          label="Open work"
          value={openTasks.length}
          detail={`${inProgressTasks.length} in progress`}
          tone="blue"
          onClick={() => onOpenDrawer("status:in_progress")}
        />
        <MiniStatusCard
          label="Overdue"
          value={overdueTasks.length}
          detail="Open tasks past due"
          tone="rose"
          onClick={() => onOpenDrawer("urgent_actions")}
        />
        <MiniStatusCard
          label="High priority"
          value={highPriorityOpen.length}
          detail="Requires attention"
          tone="amber"
          onClick={() => onOpenDrawer("urgent_actions")}
        />
        <MiniStatusCard
          label="Todo"
          value={todoTasks.length}
          detail="Tasks waiting to start"
          tone="violet"
          onClick={() => onOpenDrawer("status:todo")}
        />
      </div>
    </div>
  );
}

function CommercialToolbarButton({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
    >
      {icon}
      {children}
    </button>
  );
}

function CommercialMetricCard({
  title,
  value,
  detail,
  tone,
  icon,
  sparkSeed,
  onClick,
}: {
  title: string;
  value: string | number;
  detail: string;
  tone: MetricTone;
  icon: ReactNode;
  sparkSeed: number;
  onClick?: () => void;
}) {
  const color = metricToneStyles[tone];
  const className = cn(
    "group min-h-[158px] overflow-hidden rounded-xl border bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition",
    color.border,
    onClick && "hover:-translate-y-0.5 hover:bg-white/[0.07]",
  );
  const content = (
    <>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", color.icon)}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">
            {title}
          </p>
          <p className="mt-3 truncate text-2xl font-bold text-white">{value}</p>
          <p className={cn("mt-2 truncate text-xs", color.text)}>{detail}</p>
        </div>
      </div>
      <SparkLine tone={tone} seed={sparkSeed} />
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function SparkLine({
  tone,
  seed,
  height = 42,
}: {
  tone: MetricTone;
  seed: number;
  height?: number;
}) {
  const color = metricToneStyles[tone];
  const values = buildSparkValues(seed);
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 42 - (value / max) * 34;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="mt-4 w-full" height={height} viewBox="0 0 100 44" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.7"
        className={cn(color.line, "drop-shadow-[0_0_8px_currentColor]")}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Panel({
  title,
  children,
  action,
  onAction,
  icon,
}: {
  title: string;
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.82),rgba(5,8,18,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h4 className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
            {title}
          </h4>
        </div>
        {action && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-xs font-medium text-violet-200 hover:text-white"
          >
            {action}
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function PulseButton({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  tone: MetricTone;
  onClick: () => void;
}) {
  const color = metricToneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border bg-white/[0.035] px-3 py-2.5 text-left transition hover:bg-white/[0.07]",
        color.border,
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <span className={cn("h-2 w-2 rounded-full", color.icon)} />
        {label}
      </span>
      <span className={cn("rounded-full bg-black/25 px-2 py-1 text-xs font-bold", color.text)}>
        {value}
      </span>
    </button>
  );
}

function ActivityList({ items }: { items: ActivityEvent[] }) {
  if (items.length === 0) {
    return <EmptyPanelText>No Comercial activity yet.</EmptyPanelText>;
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3">
          <AvatarLabel label={item.actor?.name ?? "UP"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">
              {item.actor?.name ?? "System"} {humanize(item.type)}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {humanize(item.entity_type)} - {formatRelative(item.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskList({
  tasks,
  updatingTask,
  onTaskStatusChange,
}: {
  tasks: Task[];
  updatingTask: boolean;
  onTaskStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  if (tasks.length === 0) {
    return <EmptyPanelText>No upcoming Comercial tasks.</EmptyPanelText>;
  }
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
        >
          <button
            type="button"
            disabled={updatingTask || task.status === "done"}
            onClick={() => onTaskStatusChange(task, "done")}
            className="flex h-5 w-5 items-center justify-center rounded-md border border-white/20 text-slate-500 hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50"
            aria-label={`Mark ${task.title} as done`}
          >
            {task.status === "done" ? <CheckCircle2 className="h-4 w-4" /> : null}
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">{task.title}</p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {task.project?.name ?? "Project"} -{" "}
              {task.due_date ? formatDate(task.due_date) : "No due date"}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
              priorityColor(task.priority),
              "bg-white/[0.06]",
            )}
          >
            {task.priority}
          </span>
        </div>
      ))}
    </div>
  );
}

function TopProjects({ projects, maxValue }: { projects: Project[]; maxValue: number }) {
  if (projects.length === 0) {
    return <EmptyPanelText>No Comercial projects yet.</EmptyPanelText>;
  }
  return (
    <div className="space-y-3">
      {projects.map((project, index) => {
        const value = projectValue(project);
        const width = `${Math.max(12, value > 0 ? (value / maxValue) * 100 : Math.min(100, (project._count?.tasks ?? 0) * 16))}%`;
        const tone = metricToneStyles[stageTones[index % stageTones.length]];
        return (
          <div key={project.id} className="grid grid-cols-[minmax(0,1fr)_76px] gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-200">{project.name}</p>
              <p className="truncate text-xs text-slate-500">
                {project.company?.name ?? `${project._count?.tasks ?? 0} tasks`}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full", tone.icon)}
                  style={{ width }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-200">
                {value > 0 ? formatMoney(value) : "No value"}
              </p>
              <p className="text-xs text-slate-500">{project.status}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamPerformance({
  items,
}: {
  items: Array<{
    user: TeamMember;
    open_tasks: number;
    overdue_tasks: number;
    due_today_tasks: number;
    tracked_seconds_today: number;
  }>;
}) {
  if (items.length === 0) {
    return <EmptyPanelText>No team workload data yet.</EmptyPanelText>;
  }
  const maxOpenTasks = Math.max(...items.map((item) => item.open_tasks), 1);
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const tone = metricToneStyles[stageTones[index % stageTones.length]];
        const width = `${Math.max(8, (item.open_tasks / maxOpenTasks) * 100)}%`;
        return (
          <div key={item.user.id} className="grid grid-cols-[32px_minmax(0,1fr)_72px] items-center gap-3">
            <AvatarLabel label={item.user.name} />
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-200">{item.user.name}</p>
                {item.overdue_tasks > 0 && (
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                    {item.overdue_tasks} late
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={cn("h-full rounded-full", tone.icon)} style={{ width }} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-200">{item.open_tasks}</p>
              <p className="text-xs text-slate-500">
                {formatSecondsShort(item.tracked_seconds_today)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniStatusCard({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  tone: MetricTone;
  onClick: () => void;
}) {
  const color = metricToneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.07]",
        color.border,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </button>
  );
}

function EmptyPanelText({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function AvatarLabel({ label }: { label: string }) {
  const initials = label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-100">
      {initials || "UP"}
    </span>
  );
}

function buildStages(projects: Project[], tasks: Task[]) {
  const definitions: Array<{
    name: string;
    status: TaskStatus;
    keywords: string[];
    fallback: Task[];
  }> = [
    { name: "Leads", status: "todo", keywords: ["lead"], fallback: tasks.filter((task) => task.status === "todo") },
    {
      name: "Proposals",
      status: "todo",
      keywords: ["proposal", "proposta"],
      fallback: tasks.filter((task) => task.priority === "high" && task.status !== "done"),
    },
    {
      name: "Follow-ups",
      status: "in_progress",
      keywords: ["follow", "follow-up", "retorno"],
      fallback: tasks.filter((task) => task.status === "in_progress"),
    },
    {
      name: "Contracts",
      status: "in_progress",
      keywords: ["contract", "contrato"],
      fallback: tasks.filter((task) => task.status !== "done" && task.due_date),
    },
    { name: "Won", status: "done", keywords: ["won", "closed", "fechado"], fallback: tasks.filter((task) => task.status === "done") },
  ];

  return definitions.map((definition) => {
    const matchingProjects = projects.filter((project) =>
      definition.keywords.some((keyword) => project.name.toLowerCase().includes(keyword)),
    );
    const count = matchingProjects.length > 0 ? matchingProjects.length : definition.fallback.length;
    const value = matchingProjects.reduce((sum, project) => sum + projectValue(project), 0);
    return { ...definition, count, value };
  });
}

function projectValue(project: Project) {
  return Number(project.company?.contract_value ?? 0);
}

function buildSparkValues(seed: number) {
  const base = Math.max(1, Math.round(seed));
  return Array.from({ length: 10 }, (_, index) => {
    const wave = Math.sin((base + index * 11) * 0.37) + 1;
    return Math.round(20 + wave * 22 + index * 2);
  });
}

function isToday(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isOverdue(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: value >= 100000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100000 ? 1 : 0,
  }).format(value);
}

function formatRelative(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDateTime(value);
}
