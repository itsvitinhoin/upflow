"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppUser } from "@/components/user-provider";
import {
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  Plus,
  Play,
  Pause,
  Square,
  Calendar as CalendarIcon,
  MoreHorizontal,
  Video,
  RotateCcw,
  Repeat,
  X,
  FolderPlus,
  CheckSquare,
  UserPlus,
  Building2,
  ArrowRight,
  Users2,
  Timer,
  Activity,
  TrendingDown,
  Command,
  Pencil,
  Trash2,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";
import {
  cn,
  formatDate,
  formatLongDate,
  formatTime,
  getInitials,
  isOverdue,
  priorityColor,
} from "@/lib/utils";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import InviteDialog from "@/components/dashboard/invite-dialog";
import ScheduleMeetingDialog from "@/components/dashboard/schedule-meeting-dialog";
import CreateCompanyDialog from "@/components/dashboard/create-company-dialog";
import AgencyOperationsPanel from "@/components/dashboard/agency-operations-panel";
import type { ActivityEvent, CalendarEvent, Company, Project, Task, TeamMember, TimeEntry } from "@/lib/types";
import {
  buildDashboardRecent,
  buildDashboardWeekActivity,
  dashboardActivityText,
  entrySeconds,
  formatSecondsShort,
  greetingTime,
  moneyCompact,
  priorityLabel,
  sameLocalDate,
  taskStatusLabel,
} from "@/components/dashboard/dashboard-utils";

type ActionFilter = "all" | "completed" | "in_progress";
type TaskDrawerStatus = "todo" | "in_progress" | "done";
type CommandDrawer =
  | "urgent_actions"
  | "team_workload"
  | "time_today"
  | "meetings_today"
  | "recent_activity"
  | "projects_at_risk"
  | "client_risk"
  | "client_health"
  | "delivery_overview"
  | "creative_queue"
  | "department_workload"
  | "agency_risk_signals"
  | "revenue_snapshot"
  | "quick_create";

interface CommandCenterPayload {
  urgent_actions: { items: Task[]; count: number };
  team_workload: {
    items: Array<{
      user: TeamMember;
      open_tasks: number;
      overdue_tasks: number;
      due_today_tasks: number;
      tracked_seconds_today: number;
      state: "late" | "overloaded" | "idle" | "active";
    }>;
    count: number;
  };
  time_today: {
    total_seconds: number;
    running: TimeEntry | null;
    entries: TimeEntry[];
  };
  meetings_today: { items: CalendarEvent[]; count: number };
  recent_activity: { items: ActivityEvent[]; count: number };
  projects_at_risk: {
    items: Array<{ project: Project; reasons: string[] }>;
    count: number;
    rules: string[];
  };
  client_risk: {
    items: Array<{
      company: Pick<Company, "id" | "name" | "commercial_status" | "status" | "contract_value" | "commission">;
      reasons: string[];
      open_tasks: number;
      overdue_tasks: number;
    }>;
    count: number;
  };
  client_health?: {
    counts: {
      healthy: number;
      attention_needed: number;
      at_risk: number;
      not_enough_data: number;
    };
    items: Array<{
      company: Pick<Company, "id" | "name" | "commercial_status" | "status" | "contract_value" | "commission" | "plan_name" | "service_type"> & {
        owner?: { id: string; name: string; email: string } | null;
      };
      health_status: "healthy" | "attention_needed" | "at_risk" | "not_enough_data";
      reasons: string[];
      open_tasks: number;
      overdue_tasks: number;
      active_projects: number;
      contact_count: number;
      next_deadline: string | null;
      last_activity_at: string | null;
    }>;
  };
  delivery_overview?: {
    items: Array<{
      project: Pick<Project, "id" | "name" | "status" | "due_date"> & {
        owner?: { id: string; name: string; email: string } | null;
        company?: { id: string; name: string } | null;
        space?: { id: string; name: string; icon: string | null } | null;
      };
      progress: number;
      open_tasks: number;
      overdue_tasks: number;
      next_deadline: string | null;
      state: "on_track" | "attention_needed" | "at_risk" | "not_enough_data";
    }>;
  };
  creative_queue?: {
    source_note: string;
    counts: {
      waiting_for_briefing: number;
      ready_to_start: number;
      in_production: number;
      waiting_for_approval: number;
      revision_requested: number;
    };
    items: Array<{
      task: Task;
      stage:
        | "waiting_for_briefing"
        | "ready_to_start"
        | "in_production"
        | "waiting_for_approval"
        | "revision_requested";
    }>;
  };
  department_workload?: {
    items: Array<{
      department: { id: string; name: string; color: string };
      active_tasks: number;
      overdue_tasks: number;
      upcoming_tasks: number;
      assigned_members: number;
    }>;
  };
  agency_risk_signals?: {
    items: Array<{
      key: string;
      label: string;
      count: number;
      trace: string;
    }>;
  };
  revenue_snapshot: {
    active_clients: number;
    total_contract_value: number;
    total_commission: number;
    clients_without_contract_value: number;
    top_clients: Array<Pick<Company, "id" | "name" | "contract_value" | "commission">>;
  };
  quick_create: { items: string[] };
}

interface DashboardResponse {
  tasks: { items: Task[] };
  projects: { items: Project[] };
  users: { items: TeamMember[] };
  calendar_events?: { items: CalendarEvent[] };
  activity?: { items: ActivityEvent[] };
  time?: {
    running: TimeEntry | null;
    week_entries: TimeEntry[];
  };
  command_center?: CommandCenterPayload;
}

export default function DashboardPage() {
  const user = useAppUser();
  const router = useRouter();
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [commandCenter, setCommandCenter] = useState<CommandCenterPayload | null>(null);
  const [commandDrawer, setCommandDrawer] = useState<CommandDrawer | null>(null);
  const [drawerStatus, setDrawerStatus] = useState<TaskDrawerStatus | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [updating, setUpdating] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(greetingTime());
  }, []);

  const loadData = () => {
    setLoadError(null);
    fetch("/api/dashboard/summary")
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as DashboardResponse & {
          error?: string;
        };
        if (!r.ok) {
          throw new Error(data.error || `Dashboard unavailable (${r.status})`);
        }
        return data;
      })
      .then((data) => {
        if (!data.command_center) {
          throw new Error("Dashboard summary is missing command center data");
        }
        setTasks(data.tasks.items ?? []);
        setProjects(data.projects.items ?? []);
        setUsers(data.users.items ?? []);
        setCalendarEvents(data.calendar_events?.items ?? []);
        setActivity(data.activity?.items ?? []);
        setRunningEntry(data.time?.running ?? null);
        setTimeEntries(data.time?.week_entries ?? []);
        setCommandCenter(data.command_center ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Dashboard unavailable");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const drawerTasks = useMemo(
    () =>
      drawerStatus
        ? tasks
            .filter((task) => task.status === drawerStatus)
            .sort((a, b) => {
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
            })
        : [],
    [drawerStatus, tasks],
  );

  const firstName = user?.name?.split(" ")[0] || "there";
  const commandCenterData = useMemo<CommandCenterPayload>(() => {
    if (commandCenter) return commandCenter;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const urgent = tasks.filter((task) => {
      const due = task.due_date ? new Date(task.due_date) : null;
      return task.status !== "done" && (task.priority === "high" || (due !== null && due < tomorrow));
    });
    const todayEntries = timeEntries.filter((entry) => sameLocalDate(new Date(entry.started_at), today));
    const totalSeconds = todayEntries.reduce((sum, entry) => sum + entrySeconds(entry), 0);
    return {
      urgent_actions: { items: urgent, count: urgent.length },
      team_workload: {
        items: users.map((member) => ({
          user: member,
          open_tasks: member._count.tasks,
          overdue_tasks: 0,
          due_today_tasks: 0,
          tracked_seconds_today: 0,
          state: member._count.tasks >= 8 ? "overloaded" : member._count.tasks === 0 ? "idle" : "active",
        })),
        count: users.length,
      },
      time_today: { total_seconds: totalSeconds, running: runningEntry, entries: todayEntries },
      meetings_today: { items: calendarEvents, count: calendarEvents.length },
      recent_activity: { items: activity, count: activity.length },
      projects_at_risk: { items: [], count: 0, rules: [] },
      client_risk: { items: [], count: 0 },
      client_health: {
        counts: { healthy: 0, attention_needed: 0, at_risk: 0, not_enough_data: 0 },
        items: [],
      },
      delivery_overview: { items: [] },
      creative_queue: {
        source_note: "Creative queue appears when matching deliverables exist.",
        counts: {
          waiting_for_briefing: 0,
          ready_to_start: 0,
          in_production: 0,
          waiting_for_approval: 0,
          revision_requested: 0,
        },
        items: [],
      },
      department_workload: { items: [] },
      agency_risk_signals: { items: [] },
      revenue_snapshot: {
        active_clients: 0,
        total_contract_value: 0,
        total_commission: 0,
        clients_without_contract_value: 0,
        top_clients: [],
      },
      quick_create: { items: ["task", "meeting", "company", "project", "note"] },
    };
  }, [activity, calendarEvents, commandCenter, runningEntry, tasks, timeEntries, users]);

  const todayFocusTasks = useMemo(() => {
    const seen = new Set<string>();
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return [
      ...commandCenterData.urgent_actions.items,
      ...tasks.filter((task) => task.status === "in_progress"),
      ...tasks.filter((task) => task.status === "todo"),
    ]
      .filter((task) => {
        if (seen.has(task.id) || task.status === "done") return false;
        seen.add(task.id);
        return true;
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return priorityRank[a.priority] - priorityRank[b.priority];
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      })
      .slice(0, 5);
  }, [commandCenterData.urgent_actions.items, tasks]);

  const workloadFlags = useMemo(
    () =>
      commandCenterData.team_workload.items.filter((item) =>
        item.state === "late" || item.state === "overloaded",
      ),
    [commandCenterData.team_workload.items],
  );
  const riskTotal =
    commandCenterData.projects_at_risk.count + commandCenterData.client_risk.count;
  const nextMeeting = commandCenterData.meetings_today.items[0] ?? null;
  const liveTimerLabel = commandCenterData.time_today.running
    ? t("dashboard.timerRunning")
    : t("dashboard.noActiveTimer");

  const handleStatusChange = async (task: Task, status: Task["status"]) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(
        t("dashboard.taskMoved", { status: taskStatusLabel(status, t) }),
      );
      setActiveTask(null);
      loadData();
    } catch {
      toast.error(t("dashboard.couldNotUpdateTask"));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("dashboard.taskDeleted"));
      setActiveTask(null);
      loadData();
    } catch {
      toast.error(t("dashboard.couldNotDeleteTask"));
    } finally {
      setUpdating(false);
    }
  };

  if (loadError && !commandCenter) {
    return (
      <>
        <Header title={t("dashboard.title")} />
        <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
          <section className="rounded-2xl border border-upflow-danger/30 bg-upflow-danger/10 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0 text-upflow-danger" />
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Dashboard data could not load
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {loadError}. Check database connectivity, workspace access, and
                  the dashboard summary API.
                </p>
                <button
                  type="button"
                  onClick={loadData}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={t("dashboard.title")} />
      <main className="mx-auto w-full max-w-[1480px] space-y-5 overflow-x-hidden p-4 sm:p-6">
          <section className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(124,102,255,0.18),rgba(31,162,124,0.08)_42%,rgba(255,177,92,0.10))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-stretch xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  {t("dashboard.commandCenter")}
                </p>
                <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-foreground sm:text-4xl">
                  {greeting
                    ? t("dashboard.good", {
                        greeting: t(`dashboard.greeting.${greeting}`),
                        name: firstName,
                      })
                    : t("dashboard.hi", { name: firstName })}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {t("dashboard.summary")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <SignalBadge tone="danger" label={t("dashboard.risks", { count: riskTotal })} />
                  <SignalBadge tone="success" label={t("dashboard.tasksComplete", { progress })} />
                  <SignalBadge tone="info" label={liveTimerLabel} />
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-4 xl:w-[360px]">
                <QuickCreateMenu
                  onCreateTask={() => setShowNewTask(true)}
                  onCreateProject={() => setShowNewProject(true)}
                  onCreateMeeting={() => setShowSchedule(true)}
                  onCreateCompany={() => setShowCompany(true)}
                  onInvite={() => setShowInvite(true)}
                />
                <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("dashboard.operationalPulse")}
                    </p>
                    <Activity className="h-4 w-4 text-upflow-success" />
                  </div>
                  <div className="mt-4 grid gap-3 text-sm">
                    <PulseLine
                      label={t("dashboard.nextMeeting")}
                      value={
                        nextMeeting
                          ? formatTime(nextMeeting.starts_at)
                          : t("dashboard.noneToday")
                      }
                    />
                    <PulseLine
                      label={t("dashboard.focusQueue")}
                      value={t("dashboard.items", { count: todayFocusTasks.length })}
                    />
                    <PulseLine
                      label={t("dashboard.openWork")}
                      value={t("dashboard.tasksCount", { count: todoCount + inProgressCount })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryPill
                label={t("dashboard.tasks")}
                value={tasks.length}
                hint={t("dashboard.tasksComplete", { progress })}
                tone="success"
                onClick={() => setDrawerStatus("todo")}
              />
              <SummaryPill
                label={t("dashboard.teamFlags")}
                value={workloadFlags.length}
                hint={t("dashboard.lateOrOverloaded")}
                tone="warning"
                onClick={() => setCommandDrawer("team_workload")}
              />
              <SummaryPill
                label={t("dashboard.activity")}
                value={commandCenterData.recent_activity.count}
                hint={t("dashboard.workspaceTrail")}
                tone="info"
                onClick={() => setCommandDrawer("recent_activity")}
              />
            </div>
          </section>

          <TeamTimeline
            users={users}
            loading={loading}
            timeEntries={timeEntries}
            events={calendarEvents}
          />

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <CommandTile
              title={t("dashboard.myUrgentActions")}
              value={commandCenterData.urgent_actions.count}
              hint={t("dashboard.urgentHint")}
              icon={<AlertCircle className="w-4 h-4" />}
              tone="danger"
              active={commandDrawer === "urgent_actions"}
              onClick={() => setCommandDrawer("urgent_actions")}
            />
            <CommandTile
              title={t("dashboard.meetingsToday")}
              value={commandCenterData.meetings_today.count}
              hint={t("dashboard.meetingsHint")}
              icon={<CalendarIcon className="w-4 h-4" />}
              tone="info"
              active={commandDrawer === "meetings_today"}
              onClick={() => setCommandDrawer("meetings_today")}
            />
            <CommandTile
              title={t("dashboard.timeToday")}
              value={formatSecondsShort(commandCenterData.time_today.total_seconds)}
              hint={commandCenterData.time_today.running ? t("dashboard.timerRunning") : t("dashboard.trackedToday")}
              icon={<Timer className="w-4 h-4" />}
              tone="success"
              active={commandDrawer === "time_today"}
              onClick={() => setCommandDrawer("time_today")}
            />
            <CommandTile
              title={t("dashboard.projectsAtRisk")}
              value={commandCenterData.projects_at_risk.count}
              hint={t("dashboard.projectsRiskHint")}
              icon={<TrendingDown className="w-4 h-4" />}
              tone="warning"
              active={commandDrawer === "projects_at_risk"}
              onClick={() => setCommandDrawer("projects_at_risk")}
            />
            <CommandTile
              title={t("dashboard.clientRisk")}
              value={commandCenterData.client_risk.count}
              hint={t("dashboard.clientRiskHint")}
              icon={<Building2 className="w-4 h-4" />}
              tone="rose"
              active={commandDrawer === "client_risk"}
              onClick={() => setCommandDrawer("client_risk")}
            />
            <CommandTile
              title={t("dashboard.revenueSnapshot")}
              value={moneyCompact(commandCenterData.revenue_snapshot.total_contract_value)}
              hint={t("dashboard.activeClients", { count: commandCenterData.revenue_snapshot.active_clients })}
              icon={<DollarSign className="w-4 h-4" />}
              tone="violet"
              active={commandDrawer === "revenue_snapshot"}
              onClick={() => setCommandDrawer("revenue_snapshot")}
            />
          </section>

          <AgencyOperationsPanel
            data={commandCenterData}
            onOpenDrawer={setCommandDrawer}
            onOpenTask={setActiveTask}
          />

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
            <TodayFocusPanel
              loading={loading}
              tasks={todayFocusTasks}
              meetings={commandCenterData.meetings_today.items}
              onOpenTask={setActiveTask}
              onMarkDone={(task) => handleStatusChange(task, "done")}
              onCreateTask={() => setShowNewTask(true)}
              onOpenMeetings={() => setCommandDrawer("meetings_today")}
              updating={updating}
            />

            <section className="glass relative overflow-hidden rounded-2xl p-5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-upflow-warning via-primary to-upflow-success" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t("dashboard.tasks")}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("dashboard.statusHint")}
                  </p>
                </div>
                <button
                  onClick={() => setShowNewTask(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("dashboard.newTask")}
                </button>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t("dashboard.completion")}</span>
                  <span className="font-semibold text-foreground">{progress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-upflow-success to-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <StatusCountButton
                  label={t("dashboard.upcoming")}
                  value={todoCount}
                  hint={t("dashboard.upcomingHint")}
                  tone="warning"
                  onClick={() => setDrawerStatus("todo")}
                />
                <StatusCountButton
                  label={t("dashboard.inProgress")}
                  value={inProgressCount}
                  hint={t("dashboard.inProgressHint")}
                  tone="info"
                  onClick={() => setDrawerStatus("in_progress")}
                />
                <StatusCountButton
                  label={t("dashboard.completed")}
                  value={doneCount}
                  hint={t("dashboard.ofTotal", { progress })}
                  tone="success"
                  onClick={() => setDrawerStatus("done")}
                />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <button
                  onClick={() => setCommandDrawer("team_workload")}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <span className="block font-semibold text-foreground">{t("dashboard.teamWorkload")}</span>
                  {t("dashboard.membersWithSignals", { count: commandCenterData.team_workload.count })}
                </button>
                <button
                  onClick={() => setCommandDrawer("recent_activity")}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <span className="block font-semibold text-foreground">{t("dashboard.recentActivity")}</span>
                  {t("dashboard.traceableRecords", { count: commandCenterData.recent_activity.count })}
                </button>
              </div>
            </section>
          </section>

      </main>

      {showNewTask && (
        <NewTaskDialog
          open={showNewTask}
          onClose={() => setShowNewTask(false)}
          onCreated={() => {
            setShowNewTask(false);
            loadData();
            toast.success(t("dashboard.taskCreated"));
          }}
        />
      )}

      {showNewProject && (
        <NewProjectDialog
          open={showNewProject}
          onClose={() => setShowNewProject(false)}
          onCreated={() => {
            setShowNewProject(false);
            loadData();
            toast.success(t("dashboard.projectCreated"));
          }}
        />
      )}

      <InviteDialog open={showInvite} onClose={() => setShowInvite(false)} />

      <ScheduleMeetingDialog
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        onScheduled={(meeting) => {
          setCalendarEvents((prev) =>
            [...prev, meeting].sort(
              (a, b) =>
                new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
            ),
          );
          loadData();
        }}
      />

      <CreateCompanyDialog
        open={showCompany}
        onClose={() => setShowCompany(false)}
        onCreated={(company) => {
          setShowCompany(false);
          router.push(`/clients/${company.id}`);
        }}
      />

      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          updating={updating}
          onClose={() => setActiveTask(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteTask}
        />
      )}

      {drawerStatus && (
        <TaskStatusDrawer
          status={drawerStatus}
          tasks={drawerTasks}
          updating={updating}
          onClose={() => {
            setDrawerStatus(null);
          }}
          onOpenTask={setActiveTask}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteTask}
        />
      )}

      {commandDrawer && (
        <CommandCenterDrawer
          kind={commandDrawer}
          data={commandCenterData}
          onClose={() => setCommandDrawer(null)}
          onOpenTask={setActiveTask}
          onCreateTask={() => setShowNewTask(true)}
          onCreateMeeting={() => setShowSchedule(true)}
          onCreateCompany={() => setShowCompany(true)}
          onCreateProject={() => setShowNewProject(true)}
          onCalendarChanged={loadData}
        />
      )}
    </>
  );
}
function QuickCreateMenu({
  onCreateTask,
  onCreateProject,
  onCreateMeeting,
  onCreateCompany,
  onInvite,
}: {
  onCreateTask: () => void;
  onCreateProject: () => void;
  onCreateMeeting: () => void;
  onCreateCompany: () => void;
  onInvite: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  const items = [
    { label: "Task", icon: CheckSquare, action: onCreateTask },
    { label: "Project", icon: FolderPlus, action: onCreateProject },
    { label: "Meeting", icon: Video, action: onCreateMeeting },
    { label: "Company", icon: Building2, action: onCreateCompany },
    { label: "Invite", icon: UserPlus, action: onInvite },
  ];

  return (
    <div ref={menuRef} className="relative w-full sm:w-auto xl:self-end">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 sm:w-auto"
      >
        <Plus className="h-4 w-4" />
        Quick create
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-popover p-1 shadow-2xl"
        >
          {items.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => choose(action)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-white/10"
            >
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
type DashboardTone = "danger" | "warning" | "success" | "info" | "rose" | "violet";

const toneStyles: Record<
  DashboardTone,
  {
    dot: string;
    surface: string;
    border: string;
    icon: string;
    text: string;
    bar: string;
  }
> = {
  danger: {
    dot: "bg-upflow-danger",
    surface: "bg-upflow-danger/10",
    border: "border-upflow-danger/25",
    icon: "bg-upflow-danger/15 text-upflow-danger",
    text: "text-upflow-danger",
    bar: "bg-upflow-danger",
  },
  warning: {
    dot: "bg-upflow-warning",
    surface: "bg-upflow-warning/10",
    border: "border-upflow-warning/25",
    icon: "bg-upflow-warning/15 text-upflow-warning",
    text: "text-upflow-warning",
    bar: "bg-upflow-warning",
  },
  success: {
    dot: "bg-upflow-success",
    surface: "bg-upflow-success/10",
    border: "border-upflow-success/25",
    icon: "bg-upflow-success/15 text-upflow-success",
    text: "text-upflow-success",
    bar: "bg-upflow-success",
  },
  info: {
    dot: "bg-sky-400",
    surface: "bg-sky-400/10",
    border: "border-sky-400/25",
    icon: "bg-sky-400/15 text-sky-300",
    text: "text-sky-300",
    bar: "bg-sky-400",
  },
  rose: {
    dot: "bg-pink-400",
    surface: "bg-pink-400/10",
    border: "border-pink-400/25",
    icon: "bg-pink-400/15 text-pink-300",
    text: "text-pink-300",
    bar: "bg-pink-400",
  },
  violet: {
    dot: "bg-primary",
    surface: "bg-primary/10",
    border: "border-primary/25",
    icon: "bg-primary/15 text-primary",
    text: "text-primary",
    bar: "bg-primary",
  },
};

function SignalBadge({ tone, label }: { tone: DashboardTone; label: string }) {
  const styles = toneStyles[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        styles.surface,
        styles.border,
        styles.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}

function PulseLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: DashboardTone;
  onClick: () => void;
}) {
  const styles = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between gap-3 rounded-xl border bg-black/10 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-white/[0.05]",
        styles.border,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("h-9 w-1 rounded-full", styles.bar)} />
        <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {hint}
        </span>
        </span>
      </span>
      <span className={cn("shrink-0 text-xl font-bold", styles.text)}>{value}</span>
    </button>
  );
}

function StatusCountButton({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  tone: DashboardTone;
  onClick: () => void;
}) {
  const styles = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border bg-white/[0.03] px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-white/[0.06]",
        styles.border,
      )}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className={cn("h-2 w-2 rounded-full", styles.dot)} />
          {label}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
      <span className={cn("text-lg font-bold", styles.text)}>{value}</span>
    </button>
  );
}

function TodayFocusPanel({
  loading,
  tasks,
  meetings,
  onOpenTask,
  onMarkDone,
  onCreateTask,
  onOpenMeetings,
  updating,
}: {
  loading: boolean;
  tasks: Task[];
  meetings: CalendarEvent[];
  onOpenTask: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onCreateTask: () => void;
  onOpenMeetings: () => void;
  updating: boolean;
}) {
  const { t } = useLanguage();
  const visibleMeetings = meetings.slice(0, 3);
  const hasFocusItems = tasks.length > 0 || visibleMeetings.length > 0;

  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-white/5 bg-white/[0.02] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-upflow-danger/15 text-upflow-danger">
              <AlertCircle className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">{t("dashboard.todayFocus")}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("dashboard.todayFocusHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateTask}
          className="text-xs font-medium text-primary hover:underline"
        >
          + {t("dashboard.newTask")}
        </button>
      </div>
      <div className="divide-y divide-white/5">
        {loading ? (
          [1, 2, 3].map((item) => (
            <div key={item} className="px-5 py-4">
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
            </div>
          ))
        ) : !hasFocusItems ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-foreground">{t("dashboard.noFocus")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("dashboard.todayFocusHint")}
            </p>
            <button
              type="button"
              onClick={onCreateTask}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t("dashboard.newTask")}
            </button>
          </div>
        ) : (
          <>
            {visibleMeetings.length > 0 && (
              <div className="space-y-2 px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300">
                    {t("dashboard.meetingsToday")}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenMeetings}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("common.open")}
                  </button>
                </div>
                {visibleMeetings.map((meeting) => (
                  <button
                    key={meeting.id}
                    type="button"
                    onClick={onOpenMeetings}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-left hover:border-sky-300/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {meeting.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(meeting.starts_at)}
                      </span>
                    </span>
                    <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            )}
            {tasks.length > 0 && (
              <div>
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={() => onOpenTask(task)}
                    onMarkDone={() => onMarkDone(task)}
                    onDelete={() => onOpenTask(task)}
                    disabled={updating}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  onOpen,
  onMarkDone,
  onDelete,
  disabled,
}: {
  task: Task;
  onOpen: () => void;
  onMarkDone: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  return (
    <div className="group flex items-center gap-3 px-5 py-3.5 hover:bg-white/5 transition-colors">
      <div
        className={cn(
          "w-1.5 h-8 rounded-full flex-shrink-0",
          task.priority === "high"
            ? "bg-upflow-danger"
            : task.priority === "medium"
            ? "bg-upflow-warning"
            : "bg-muted-foreground/40"
        )}
      />
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <p className="text-sm font-medium text-foreground truncate">
          {task.title}
        </p>
        {task.project?.name && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {task.project.name}
          </p>
        )}
      </button>
      <span
        className={cn(
          "text-xs px-2 py-1 rounded-full font-medium",
          priorityColor(task.priority)
        )}
      >
        {priorityLabel(task.priority, t)}
      </span>
      {task.due_date && (
        <span
          className={cn(
            "text-xs text-muted-foreground hidden sm:block",
            isOverdue(task.due_date) &&
              task.status !== "done" &&
              "text-upflow-danger font-medium"
          )}
        >
          {formatDate(task.due_date)}
        </span>
      )}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Actions for ${task.title}`}
          aria-expanded={menuOpen}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-40 glass-strong rounded-lg z-30 overflow-hidden text-xs"
          >
            <button
              role="menuitem"
              type="button"
              disabled={disabled || task.status === "done"}
              onClick={() => {
                setMenuOpen(false);
                onMarkDone();
              }}
              className="w-full text-left px-3 py-2 hover:bg-white/5 disabled:opacity-40 focus:outline-none focus-visible:bg-white/10"
            >
              {t("status.done")}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpen();
              }}
              className="w-full text-left px-3 py-2 hover:bg-white/5 border-t border-white/5 focus:outline-none focus-visible:bg-white/10"
            >
              {t("common.open")}
            </button>
            <button
              role="menuitem"
              type="button"
              disabled={disabled}
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-40 border-t border-white/5 focus:outline-none focus-visible:bg-upflow-danger/15"
            >
              {t("common.delete")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskStatusDrawer({
  status,
  tasks,
  updating,
  onClose,
  onOpenTask,
  onStatusChange,
  onDelete,
}: {
  status: TaskDrawerStatus;
  tasks: Task[];
  updating: boolean;
  onClose: () => void;
  onOpenTask: (task: Task) => void;
  onStatusChange: (task: Task, status: Task["status"]) => void;
  onDelete: (task: Task) => void;
}) {
  const { t } = useLanguage();
  const label =
    status === "todo" ? t("dashboard.upcoming") : status === "in_progress" ? t("dashboard.inProgress") : t("dashboard.completed");

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-dvh w-full max-w-md overflow-y-auto border-l border-white/10 p-4 glass-strong sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="hidden">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("dashboard.tasks")}
            </p>
            <h2 className="text-lg font-semibold text-foreground mt-1">{label}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("dashboard.tasksCount", { count: tasks.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10"
            aria-label="Close task drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 divide-y divide-white/5 rounded-xl overflow-hidden border border-white/5">
          {tasks.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">{t("dashboard.noFocus")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("dashboard.statusHint")}
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => onOpenTask(task)}
                onMarkDone={() => onStatusChange(task, "done")}
                onDelete={() => {
                  if (confirm(`Delete "${task.title}"?`)) onDelete(task);
                }}
                disabled={updating}
              />
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function CommandTile({
  title,
  value,
  hint,
  icon,
  tone,
  active,
  onClick,
}: {
  title: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  tone: DashboardTone;
  active: boolean;
  onClick: () => void;
}) {
  const styles = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card/75 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:-translate-y-0.5 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-primary/60",
        styles.border,
        active && "border-primary/70 bg-primary/10",
      )}
    >
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 opacity-80 transition-opacity group-hover:opacity-100",
          styles.bar,
        )}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          {title}
        </span>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", styles.icon)}>
          {icon}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
        <ArrowRight className={cn("mb-1 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100", styles.text)} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}

function creativeStageLabel(stage: NonNullable<CommandCenterPayload["creative_queue"]>["items"][number]["stage"]) {
  const labels: Record<typeof stage, string> = {
    waiting_for_briefing: "Briefing",
    ready_to_start: "Ready",
    in_production: "Production",
    waiting_for_approval: "Approval",
    revision_requested: "Revision",
  };
  return labels[stage];
}

function healthLabel(status: NonNullable<CommandCenterPayload["client_health"]>["items"][number]["health_status"]) {
  const labels: Record<typeof status, string> = {
    healthy: "Healthy",
    attention_needed: "Needs attention",
    at_risk: "At risk",
    not_enough_data: "Not enough data",
  };
  return labels[status];
}

function CommandCenterDrawer({
  kind,
  data,
  onClose,
  onOpenTask,
  onCreateTask,
  onCreateMeeting,
  onCreateCompany,
  onCreateProject,
  onCalendarChanged,
}: {
  kind: CommandDrawer;
  data: CommandCenterPayload;
  onClose: () => void;
  onOpenTask: (task: Task) => void;
  onCreateTask: () => void;
  onCreateMeeting: () => void;
  onCreateCompany: () => void;
  onCreateProject: () => void;
  onCalendarChanged: () => void;
}) {
  const [manageMeetings, setManageMeetings] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<CalendarEvent | null>(null);
  const titleMap: Record<CommandDrawer, string> = {
    urgent_actions: "My urgent actions",
    team_workload: "Team workload",
    time_today: "Time today",
    meetings_today: "Meetings today",
    recent_activity: "Recent activity",
    projects_at_risk: "Projects at risk",
    client_risk: "Client risk",
    client_health: "Client health overview",
    delivery_overview: "Campaign delivery overview",
    creative_queue: "Creative production queue",
    department_workload: "Workload by department",
    agency_risk_signals: "Agency risk signals",
    revenue_snapshot: "Revenue snapshot",
    quick_create: "Quick create",
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-dvh w-full max-w-lg overflow-y-auto border-l border-white/10 p-4 glass-strong sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Command Center
            </p>
            <h2 className="text-lg font-semibold text-foreground mt-1">{titleMap[kind]}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10"
            aria-label="Close command drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {kind === "urgent_actions" &&
            (data.urgent_actions.items.length === 0 ? (
              <DrawerEmpty title="No urgent actions" text="Due, overdue, and high-priority assigned tasks appear here." />
            ) : (
              data.urgent_actions.items.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.06]"
                >
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.project?.name ?? "No project"} {task.due_date ? `- ${formatDate(task.due_date)}` : ""}
                  </p>
                </button>
              ))
            ))}

          {kind === "team_workload" &&
            data.team_workload.items.map((item) => (
              <div key={item.user.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.user.name}</p>
                    <p className="text-xs text-muted-foreground">{item.user.email}</p>
                  </div>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-xs capitalize text-foreground">
                    {item.state}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.open_tasks} open - {item.overdue_tasks} overdue - {formatSecondsShort(item.tracked_seconds_today)} today
                </p>
              </div>
            ))}

          {kind === "time_today" &&
            (data.time_today.entries.length === 0 && !data.time_today.running ? (
              <DrawerEmpty title="No tracked time today" text="Start a timer to create the first real time entry." />
            ) : (
              <>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs text-muted-foreground">Total today</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {formatSecondsShort(data.time_today.total_seconds)}
                  </p>
                </div>
                {data.time_today.entries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                    <p className="text-sm font-medium text-foreground">
                      {entry.task?.title ?? entry.project?.name ?? entry.description ?? "Tracked time"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatSecondsShort(entrySeconds(entry))} {entry.status === "running" ? "running" : "logged"}
                    </p>
                  </div>
                ))}
              </>
            ))}

          {kind === "meetings_today" &&
            (data.meetings_today.items.length === 0 ? (
              <div className="space-y-3">
                <MeetingsManageHeader
                  manage={manageMeetings}
                  onManageChange={setManageMeetings}
                  onAdd={onCreateMeeting}
                />
                <DrawerEmpty title="No meetings today" text="Calendar events created in this workspace appear here." />
                {manageMeetings && (
                  <button
                    type="button"
                    onClick={onCreateMeeting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" />
                    Add meeting
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <MeetingsManageHeader
                  manage={manageMeetings}
                  onManageChange={setManageMeetings}
                  onAdd={onCreateMeeting}
                />
                {data.meetings_today.items.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06]"
                  >
                    <Link href="/calendar" className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.starts_at)}</p>
                    </Link>
                    {manageMeetings && (
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingMeeting(event)}
                          aria-label={`Edit ${event.title}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteDashboardMeeting(event, onCalendarChanged)}
                          aria-label={`Delete ${event.title}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-upflow-danger hover:bg-upflow-danger/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

          {kind === "recent_activity" &&
            (data.recent_activity.items.length === 0 ? (
              <DrawerEmpty title="No recent activity" text="Meaningful workspace operations will be listed here." />
            ) : (
              data.recent_activity.items.map((event) => (
                <div key={event.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    {dashboardActivityText(event).what} {dashboardActivityText(event).target}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
                </div>
              ))
            ))}

          {kind === "projects_at_risk" &&
            (data.projects_at_risk.items.length === 0 ? (
              <DrawerEmpty title="No projects at risk" text="Risk rules currently check overdue tasks and lack of recent activity." />
            ) : (
              data.projects_at_risk.items.map(({ project, reasons }) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06]"
                >
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{reasons.join(" - ")}</p>
                </Link>
              ))
            ))}

          {kind === "client_risk" &&
            (data.client_risk.items.length === 0 ? (
              <DrawerEmpty title="No clients at risk" text="Client risk checks linked projects, contacts, overdue work, contract value, and recent activity." />
            ) : (
              data.client_risk.items.map(({ company, reasons, open_tasks, overdue_tasks }) => (
                <Link
                  key={company.id}
                  href={`/clients/${company.id}`}
                  className="block rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{company.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{reasons.join(" - ")}</p>
                    </div>
                    <span className="rounded-full bg-upflow-danger/15 px-2 py-1 text-xs text-upflow-danger">
                      {overdue_tasks} overdue
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {open_tasks} open tasks - {moneyCompact(company.contract_value)}
                  </p>
                </Link>
              ))
            ))}

          {kind === "client_health" &&
            (!data.client_health?.items.length ? (
              <DrawerEmpty title="Not enough client data yet" text="Client health appears after clients have linked work, contacts, plan data, or activity." />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <HealthCount label="Healthy" value={data.client_health.counts.healthy} />
                  <HealthCount label="Needs attention" value={data.client_health.counts.attention_needed} />
                  <HealthCount label="At risk" value={data.client_health.counts.at_risk} />
                  <HealthCount label="Not enough data" value={data.client_health.counts.not_enough_data} />
                </div>
                {data.client_health.items.map((item) => (
                  <Link
                    key={item.company.id}
                    href={`/clients/${item.company.id}`}
                    className="block rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.company.name}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {item.company.plan_name ?? item.company.service_type ?? "Plan not set"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-foreground">
                        {healthLabel(item.health_status)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.active_projects} active projects - {item.open_tasks} open tasks
                      {item.next_deadline ? ` - next ${formatDate(item.next_deadline)}` : " - no deadline"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.reasons.length ? item.reasons.join(" - ") : "No traceable client health issues"}
                    </p>
                  </Link>
                ))}
              </div>
            ))}

          {kind === "delivery_overview" &&
            (!data.delivery_overview?.items.length ? (
              <DrawerEmpty title="No active client work yet" text="Apply an agency template or create a client campaign to start tracking delivery." />
            ) : (
              data.delivery_overview.items.map((item) => (
                <Link
                  key={item.project.id}
                  href={`/projects/${item.project.id}`}
                  className="block rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.project.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {item.project.company?.name ?? item.project.space?.name ?? "Internal operation"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-foreground">{item.progress}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-upflow-success" style={{ width: `${item.progress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.open_tasks} open - {item.overdue_tasks} overdue
                    {item.next_deadline ? ` - next ${formatDate(item.next_deadline)}` : " - no deadline"}
                  </p>
                </Link>
              ))
            ))}

          {kind === "creative_queue" &&
            (!data.creative_queue?.items.length ? (
              <DrawerEmpty title="No creative queue yet" text="Use Creative, Production, or Marketing task templates to make creative deliverables visible here." />
            ) : (
              <div className="space-y-3">
                <p className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-xs text-muted-foreground">
                  {data.creative_queue.source_note}
                </p>
                {data.creative_queue.items.map(({ task, stage }) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task)}
                    className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {task.project?.name ?? "No project"}{task.due_date ? ` - ${formatDate(task.due_date)}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                        {creativeStageLabel(stage)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ))}

          {kind === "department_workload" &&
            (!data.department_workload?.items.length ? (
              <DrawerEmpty title="No department workload yet" text="Assign members to departments and tasks to members to populate this view." />
            ) : (
              data.department_workload.items.map((item) => (
                <div key={item.department.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{item.department.name}</p>
                    <span className="text-lg font-bold text-foreground">{item.active_tasks}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.assigned_members} members - {item.upcoming_tasks} due soon - {item.overdue_tasks} overdue
                  </p>
                </div>
              ))
            ))}

          {kind === "agency_risk_signals" &&
            (!data.agency_risk_signals?.items.length ? (
              <DrawerEmpty title="No agency risk signals yet" text="Traceable operational risk appears after tasks, clients, projects, owners, and activity records exist." />
            ) : (
              data.agency_risk_signals.items.map((signal) => (
                <div key={signal.key} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{signal.label}</p>
                    <span className="text-xl font-bold text-foreground">{signal.count}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{signal.trace}</p>
                </div>
              ))
            ))}

          {kind === "revenue_snapshot" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs text-muted-foreground">Contract value</p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {moneyCompact(data.revenue_snapshot.total_contract_value)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs text-muted-foreground">Commission</p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {moneyCompact(data.revenue_snapshot.total_commission)}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  {data.revenue_snapshot.active_clients} active clients
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.revenue_snapshot.clients_without_contract_value} missing contract value
                </p>
              </div>
              {data.revenue_snapshot.top_clients.length === 0 ? (
                <DrawerEmpty title="No contract values yet" text="Add contract values to client records to make this operational." />
              ) : (
                data.revenue_snapshot.top_clients.map((company) => (
                  <Link
                    key={company.id}
                    href={`/clients/${company.id}`}
                    className="block rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06]"
                  >
                    <p className="text-sm font-medium text-foreground">{company.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Contract {moneyCompact(company.contract_value)} - Commission {moneyCompact(company.commission)}
                    </p>
                  </Link>
                ))
              )}
            </div>
          )}

          {kind === "quick_create" && (
            <div className="grid gap-2">
              <button type="button" onClick={onCreateTask} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left text-sm text-foreground hover:bg-white/[0.06]">Create task</button>
              <button type="button" onClick={onCreateMeeting} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left text-sm text-foreground hover:bg-white/[0.06]">Schedule meeting</button>
              <button type="button" onClick={onCreateCompany} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left text-sm text-foreground hover:bg-white/[0.06]">Create company</button>
              <button type="button" onClick={onCreateProject} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left text-sm text-foreground hover:bg-white/[0.06]">Create project</button>
              <Link href="/docs" className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm text-foreground hover:bg-white/[0.06]">Create note</Link>
            </div>
          )}
        </div>
        {editingMeeting && (
          <DashboardMeetingEditor
            event={editingMeeting}
            onClose={() => setEditingMeeting(null)}
            onSaved={() => {
              setEditingMeeting(null);
              onCalendarChanged();
            }}
          />
        )}
      </aside>
    </div>
  );
}

function MeetingsManageHeader({
  manage,
  onManageChange,
  onAdd,
}: {
  manage: boolean;
  onManageChange: (next: boolean) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
        <button
          type="button"
          onClick={() => onManageChange(false)}
          className={cn(
            "rounded-md px-3 py-1 text-xs transition-colors",
            !manage ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          View
        </button>
        <button
          type="button"
          onClick={() => onManageChange(true)}
          className={cn(
            "rounded-md px-3 py-1 text-xs transition-colors",
            manage ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Manage
        </button>
      </div>
      {manage && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add meeting
        </button>
      )}
    </div>
  );
}

async function deleteDashboardMeeting(event: CalendarEvent, onDeleted: () => void) {
  if (!confirm(`Delete "${event.title}"?`)) return;
  try {
    const res = await fetch(`/api/calendar/events/${event.id}`, { method: "DELETE" });
    if (res.status === 403) {
      toast.error("You do not have permission to manage this event");
      return;
    }
    if (!res.ok) throw new Error("Failed to delete meeting");
    toast.success("Meeting deleted");
    onDeleted();
  } catch {
    toast.error("Could not delete meeting");
  }
}

function dashboardTimeInput(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function mergeDashboardEventDate(event: CalendarEvent, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(event.starts_at);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

function DashboardMeetingEditor({
  event,
  onClose,
  onSaved,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [time, setTime] = useState(dashboardTimeInput(event.starts_at));
  const [location, setLocation] = useState(event.location ?? "");
  const [submitting, setSubmitting] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const startsAt = mergeDashboardEventDate(event, time);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          location: location.trim() || null,
        }),
      });
      if (res.status === 403) {
        toast.error("You do not have permission to manage this event");
        return;
      }
      if (!res.ok) throw new Error("Failed to update meeting");
      toast.success("Meeting updated");
      onSaved();
    } catch {
      toast.error("Could not update meeting");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={save}
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Manage {event.type === "meeting" ? "meeting" : "event"}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => void deleteDashboardMeeting(event, onSaved)}
            disabled={submitting}
            className="flex w-10 items-center justify-center rounded-lg border border-upflow-danger/30 text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-40"
            aria-label="Delete meeting"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-foreground hover:bg-white/10 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function DrawerEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-5 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function HealthCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatCard({
  tone,
  label,
  value,
  accent,
  icon,
  hint,
  active,
  onClick,
}: {
  tone: "stat-1" | "stat-2" | "stat-3";
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  const wash =
    tone === "stat-1"
      ? "bg-gradient-to-br from-upflow-stat-1-from/35 via-upflow-stat-1-to/60 to-upflow-stat-1-to/40"
      : tone === "stat-2"
      ? "bg-gradient-to-br from-upflow-stat-2-from/35 via-upflow-stat-2-to/60 to-upflow-stat-2-to/40"
      : "bg-gradient-to-br from-upflow-stat-3-from/35 via-upflow-stat-3-to/60 to-upflow-stat-3-to/40";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 text-left glass transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/60",
        active && "ring-2 ring-primary/70"
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0", wash)} />
      <div className="pointer-events-none absolute -top-12 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <p className="text-xs font-medium text-foreground/80 uppercase tracking-wide">
          {label}
        </p>
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-xl bg-background/40 backdrop-blur",
            accent
          )}
        >
          {icon}
        </div>
      </div>
      <h3 className="relative mt-3 text-3xl font-bold text-foreground">{value}</h3>
      <p className="relative mt-1 text-xs text-foreground/60">{hint}</p>
      {active && (
        <span className="relative mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-primary">
          Filtering ↓
        </span>
      )}
    </button>
  );
}

type TimelineBlock = {
  start: number;
  end: number;
  label: string;
};

function decimalHour(value: string) {
  const date = new Date(value);
  return date.getHours() + date.getMinutes() / 60;
}

function clampTimelineBlock(start: number, end: number): TimelineBlock | null {
  const clampedStart = Math.max(8, Math.min(19, start));
  const clampedEnd = Math.max(clampedStart + 0.25, Math.min(19, end));
  if (clampedEnd <= 8 || clampedStart >= 19) return null;
  return { start: clampedStart, end: clampedEnd, label: "" };
}

function buildTimelineRowsFromData(
  users: TeamMember[],
  timeEntries: TimeEntry[],
  events: CalendarEvent[],
) {
  const today = new Date();
  const colors = [
    "bg-primary/40 border-l-primary",
    "bg-upflow-success/30 border-l-upflow-success",
    "bg-upflow-warning/30 border-l-upflow-warning",
    "bg-upflow-danger/30 border-l-upflow-danger",
  ];

  return users.slice(0, 5).map((user, index) => {
    const blocks: TimelineBlock[] = [];

    timeEntries
      .filter((entry) => entry.user_id === user.id && sameLocalDate(new Date(entry.started_at), today))
      .forEach((entry) => {
        const start = decimalHour(entry.started_at);
        const end = entry.stopped_at ? decimalHour(entry.stopped_at) : decimalHour(new Date().toISOString());
        const block = clampTimelineBlock(start, end);
        if (block) blocks.push({ ...block, label: entry.project?.name ?? "Tracked time" });
      });

    events
      .filter((event) => {
        if (!sameLocalDate(new Date(event.starts_at), today)) return false;
        if (event.created_by === user.id) return true;
        return event.attendees?.some((attendee) => attendee.user_id === user.id);
      })
      .forEach((event) => {
        const start = decimalHour(event.starts_at);
        const end = event.ends_at ? decimalHour(event.ends_at) : start + 0.5;
        const block = clampTimelineBlock(start, end);
        if (block) blocks.push({ ...block, label: event.title });
      });

    return {
      user,
      blocks: blocks.sort((a, b) => a.start - b.start),
      color: colors[index % colors.length],
    };
  });
}

function TeamTimeline({
  users,
  loading,
  timeEntries,
  events,
}: {
  users: TeamMember[];
  loading: boolean;
  timeEntries: TimeEntry[];
  events: CalendarEvent[];
}) {
  const focusedLabel = null as string | null;
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i);
  const totalHours = 11;
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [todayLabel, setTodayLabel] = useState<string>("");
  const [focusHour, setFocusHour] = useState<number | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    setCurrentHour(now.getHours());
    setTodayLabel(formatLongDate(now));
  }, []);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
      }
    }
    if (optionsOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [optionsOpen]);

  const rows = useMemo(
    () => buildTimelineRowsFromData(users, timeEntries, events),
    [users, timeEntries, events],
  );
  const scheduledBlocks = rows.reduce((sum, row) => sum + row.blocks.length, 0);

  const inFocusWindow = (h: number) =>
    focusHour !== null && Math.abs(h - focusHour) <= 2;

  return (
    <section className="glass relative overflow-hidden rounded-2xl p-4 sm:p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-primary to-upflow-success" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300">
              <Users2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Team timeline</h3>
              <p className="text-xs text-muted-foreground">
                Live schedule from meetings and tracked time
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            <span suppressHydrationWarning>{todayLabel || "\u00A0"}</span>
            {focusedLabel && (
              <>
                {" - "}
                <span className="text-primary">Showing {focusedLabel.toLowerCase()}s</span>
              </>
            )}
            {focusHour !== null && (
              <>
                {" - "}
                <button
                  onClick={() => setFocusHour(null)}
                  className="text-primary hover:underline"
                >
                  Clear focus
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground">
            {rows.length} people
          </span>
          <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300">
            {scheduledBlocks} blocks
          </span>
          <div className="relative" ref={optionsRef}>
            <button
              onClick={() => setOptionsOpen((v) => !v)}
              aria-label="Timeline options"
              aria-expanded={optionsOpen}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {optionsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg text-xs glass-strong"
              >
                <button
                  role="menuitem"
                  type="button"
                  disabled={focusHour === null}
                  onClick={() => {
                    setFocusHour(null);
                    setOptionsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-white/5 disabled:opacity-40 focus:outline-none focus-visible:bg-white/10"
                >
                  Clear focus window
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setCompact((v) => !v);
                    setOptionsOpen(false);
                  }}
                  className="w-full border-t border-white/5 px-3 py-2 text-left hover:bg-white/5 focus:outline-none focus-visible:bg-white/10"
                >
                  {compact ? "Comfortable density" : "Compact density"}
                </button>
                <Link
                  role="menuitem"
                  href="/team"
                  onClick={() => setOptionsOpen(false)}
                  className="block w-full border-t border-white/5 px-3 py-2 text-left hover:bg-white/5 focus:outline-none focus-visible:bg-white/10"
                >
                  Open team page
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hour pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 sm:pl-[132px]">
        {hours.map((h) => {
          const isCurrent = h === currentHour;
          const isFocus = focusHour === h;
          const inWindow = inFocusWindow(h);
          return (
            <button
              key={h}
              onClick={() =>
                setFocusHour((f) => (f === h ? null : h))
              }
              aria-pressed={isFocus}
              title={`Focus around ${h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}`}
              className={cn(
                "flex-1 min-w-[44px] text-center px-2 py-1.5 text-xs rounded-lg font-medium transition-all hover:text-foreground",
                isFocus
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/60"
                  : isCurrent
                  ? "bg-primary/80 text-primary-foreground"
                  : inWindow
                  ? "bg-primary/20 text-foreground"
                  : "text-muted-foreground bg-white/5 hover:bg-white/10"
              )}
            >
              {h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}
            </button>
          );
        })}
      </div>

      {/* Per-teammate rows */}
      <div className={cn("mt-2", compact ? "space-y-1" : "space-y-2")}>
        {loading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No teammates to show
          </div>
        ) : (
          rows.map(({ user: u, blocks, color }) => {
            const rowMatches = focusedLabel
              ? blocks.some((b) => b.label === focusedLabel)
              : true;
            return (
            <button
              key={u.id}
              onClick={() => toast(`Open ${u.name}'s schedule`)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg p-1 -mx-1 hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                !rowMatches && "opacity-30"
              )}
            >
              <div className="flex w-[104px] flex-shrink-0 items-center gap-2 sm:w-[120px]">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  {getInitials(u.name)}
                </div>
                <span className="text-xs text-foreground truncate text-left">{u.name}</span>
              </div>
              <div className={cn("relative flex-1 rounded-lg bg-white/5 overflow-hidden", compact ? "h-6" : "h-9")}>
                <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-12">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className={cn(
                        "border-r border-white/5 last:border-r-0 transition-colors",
                        h === currentHour && "bg-primary/10",
                        focusHour !== null && inFocusWindow(h) && "bg-primary/15",
                        focusHour !== null && !inFocusWindow(h) && "opacity-50"
                      )}
                    />
                  ))}
                </div>
                {blocks.map((b, i) => {
                  const fmtH = (n: number) =>
                    n > 12 ? `${n - 12}pm` : n === 12 ? "12pm" : `${n}am`;
                  const dimByLabel =
                    focusedLabel !== null && b.label !== focusedLabel;
                  const dimByHour =
                    focusHour !== null &&
                    !(b.start <= focusHour + 2 && b.end >= focusHour - 2);
                  return (
                    <div
                      key={i}
                      title={`${u.name} - ${b.label} - ${fmtH(b.start)} – ${fmtH(b.end)}`}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-md border-l-2 px-2 flex items-center text-[10px] font-medium text-foreground/80 truncate transition-opacity",
                        color,
                        (dimByLabel || dimByHour) && "opacity-30"
                      )}
                      style={{
                        left: `calc(${((b.start - 8) / totalHours) * 100}% + 2px)`,
                        width: `calc(${Math.max(((b.end - b.start) / totalHours) * 100, 4)}% - 4px)`,
                      }}
                    >
                      {b.label}
                    </div>
                  );
                })}
              </div>
            </button>
            );
          })
        )}
      </div>
    </section>
  );
}

type TimerState = "stopped" | "running" | "paused";

function RightPanel({
  projects,
  meetings,
  activity,
  runningEntry,
  timeEntries,
  onTimerChanged,
  onCreateMeeting,
}: {
  projects: Project[];
  meetings: CalendarEvent[];
  activity: ActivityEvent[];
  runningEntry: TimeEntry | null;
  timeEntries: TimeEntry[];
  onTimerChanged: () => void;
  onCreateMeeting: () => void;
}) {
  const [timerState, setTimerState] = useState<TimerState>("stopped");
  const [seconds, setSeconds] = useState(0);
  const [activeProjectIdx, setActiveProjectIdx] = useState(0);
  const [splits, setSplits] = useState<{ project: string; duration: string }[]>([]);
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);
  const [manageMeetings, setManageMeetings] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<CalendarEvent | null>(null);
  const timerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (timerMenuRef.current && !timerMenuRef.current.contains(e.target as Node)) {
        setTimerMenuOpen(false);
      }
    }
    if (timerMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [timerMenuOpen]);

  useEffect(() => {
    if (timerState !== "running") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerState]);

  useEffect(() => {
    if (!runningEntry) {
      setTimerState("stopped");
      setSeconds(0);
      return;
    }
    setTimerState("running");
    setSeconds(Math.max(0, Math.round((Date.now() - new Date(runningEntry.started_at).getTime()) / 1000)));
  }, [runningEntry]);

  const fmt = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const todayMeetings = useMemo(
    () =>
      meetings
        .filter((meeting) => sameLocalDate(new Date(meeting.starts_at), new Date()))
        .map((meeting) => ({
          id: meeting.id,
          time: formatTime(meeting.starts_at),
          title: meeting.title,
          event: meeting,
        }))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [meetings],
  );
  const extraMeetings = useMemo<typeof todayMeetings>(() => [], []);

  const allMeetings = useMemo(
    () =>
      [...todayMeetings, ...extraMeetings].sort((a, b) =>
        a.time.localeCompare(b.time)
      ),
    [todayMeetings, extraMeetings]
  );
  const am = allMeetings.filter((m) => parseInt(m.time) < 12);
  const pm = allMeetings.filter((m) => parseInt(m.time) >= 12);

  const [meetingsOpen, setMeetingsOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(todayMeetings.map((m) => [m.id, true]))
  );

  useEffect(() => {
    setMeetingsOpen((prev) => {
      const next = { ...prev };
      for (const m of allMeetings) {
        if (!(m.id in next)) next[m.id] = true;
      }
      return next;
    });
  }, [allMeetings]);

  const todayIdx = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const weekActivity = useMemo(
    () => buildDashboardWeekActivity(activity, timeEntries),
    [activity, timeEntries],
  );
  const recent = useMemo(() => buildDashboardRecent(activity), [activity]);

  const filteredRecent = useMemo(() => {
    let list = recent;
    if (actionFilter !== "all") {
      list = list.filter((r) => r.status === actionFilter);
    }
    if (activeDay !== null) {
      list = list.filter((r) => r.dayIndex === activeDay);
    }
    return list;
  }, [recent, actionFilter, activeDay]);

  const activeProject = runningEntry?.project?.name || projects[activeProjectIdx]?.name || "No active project";
  const activeProjectId = projects[activeProjectIdx]?.id;

  const handleStart = async () => {
    try {
      const res = await fetch("/api/time/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeProjectId ? { project_id: activeProjectId } : {}),
      });
      if (!res.ok) throw new Error("Failed to start timer");
      setTimerState("running");
      toast.success("Timer started");
      onTimerChanged();
    } catch {
      toast.error("Could not start timer");
    }
  };
  const handlePause = () => toast("Pause is not available for persisted timers yet");
  const handleStop = async () => {
    if (!runningEntry) return;
    try {
      const res = await fetch("/api/time/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: runningEntry.id }),
      });
      if (!res.ok) throw new Error("Failed to stop timer");
      setSplits((prev) => [
        { project: activeProject, duration: `${h}h ${m}m` },
        ...prev,
      ].slice(0, 4));
      setTimerState("stopped");
      setSeconds(0);
      toast.success("Timer stopped");
      onTimerChanged();
    } catch {
      toast.error("Could not stop timer");
    }
  };

  const handleReset = () => {
    if (runningEntry) {
      void handleStop();
    } else {
      setTimerState("stopped");
      setSeconds(0);
    }
    setTimerMenuOpen(false);
  };

  const handleSwitchProject = () => {
    if (projects.length <= 1) {
      toast("No other projects to switch to");
      setTimerMenuOpen(false);
      return;
    }
    setActiveProjectIdx((i) => (i + 1) % projects.length);
    setTimerMenuOpen(false);
    toast.success(`Switched to ${projects[(activeProjectIdx + 1) % projects.length].name}`);
  };

  return (
    <aside className="hidden lg:flex w-[280px] flex-shrink-0 flex-col gap-4 p-6 border-l border-white/5">
      {/* Time tracking */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Time tracking
          </p>
          <div className="relative" ref={timerMenuRef}>
            <button
              onClick={() => setTimerMenuOpen((v) => !v)}
              aria-label="Time tracking options"
              aria-expanded={timerMenuOpen}
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {timerMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 glass-strong rounded-xl z-50 overflow-hidden text-xs">
                <button
                  onClick={handleReset}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-left"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset timer
                </button>
                <button
                  onClick={handleSwitchProject}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-left border-t border-white/5"
                >
                  <Repeat className="w-3.5 h-3.5" /> Switch project
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="font-mono text-3xl font-bold text-foreground tabular-nums">
          {fmt(h)}:{fmt(m)}:{fmt(s)}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">{activeProject}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
          <button
            onClick={handleStart}
            disabled={timerState === "running"}
            aria-label="Start timer"
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </button>
          <button
            onClick={handleStop}
            disabled={timerState === "stopped"}
            aria-label="Stop timer"
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-upflow-danger text-white hover:bg-upflow-danger/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-upflow-danger/30"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
          <button
            onClick={handlePause}
            disabled={timerState !== "running"}
            aria-label="Pause timer"
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-white/5 text-foreground hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
        </div>
        {splits.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Recent splits
            </p>
            <ul className="space-y-1">
              {splits.map((sp, i) => (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/80 truncate pr-2">{sp.project}</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {sp.duration}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Today's meetings */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Today meetings
          </p>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
              <button
                type="button"
                onClick={() => setManageMeetings(false)}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] transition-colors",
                  !manageMeetings ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                View
              </button>
              <button
                type="button"
                onClick={() => setManageMeetings(true)}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] transition-colors",
                  manageMeetings ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Manage
              </button>
            </div>
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        {manageMeetings && (
          <button
            type="button"
            onClick={onCreateMeeting}
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add meeting
          </button>
        )}

        {[
          { label: "AM", items: am },
          { label: "PM", items: pm },
        ].map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((mt) => {
                    const open = meetingsOpen[mt.id];
                    return (
                      <div
                        key={mt.id}
                        className="flex items-center gap-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors -mx-2 px-2"
                      >
                        <button
                          onClick={() => toast(`Joining ${mt.title}…`, { icon: "📹" })}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <span className="font-mono text-xs font-semibold text-foreground/90 tabular-nums w-12 flex-shrink-0">
                            {mt.time}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground truncate">
                              {mt.title}
                            </p>
                          </div>
                          <Video className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        </button>
                        <button
                          onClick={() =>
                            setMeetingsOpen((s) => ({
                              ...s,
                              [mt.id]: !s[mt.id],
                            }))
                          }
                          aria-pressed={open}
                          aria-label={`Toggle ${mt.title}`}
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
                            open ? "bg-primary" : "bg-white/10"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                              open ? "translate-x-[18px]" : "translate-x-[3px]"
                            )}
                          />
                        </button>
                        {manageMeetings && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingMeeting(mt.event)}
                              aria-label={`Edit ${mt.title}`}
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-white/10 hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteDashboardMeeting(mt.event, onTimerChanged)}
                              aria-label={`Delete ${mt.title}`}
                              className="flex h-6 w-6 items-center justify-center rounded text-upflow-danger hover:bg-upflow-danger/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
        )}
        <Link
          href="/calendar"
          className="inline-block text-xs text-primary hover:text-primary/80 mt-1"
        >
          View all →
        </Link>
        {editingMeeting && (
          <DashboardMeetingEditor
            event={editingMeeting}
            onClose={() => setEditingMeeting(null)}
            onSaved={() => {
              setEditingMeeting(null);
              onTimerChanged();
            }}
          />
        )}
      </div>

      {/* Activity */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Activity
          </p>
          {activeDay !== null ? (
            <button
              onClick={() => setActiveDay(null)}
              className="text-[10px] text-primary hover:underline"
            >
              Clear
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Last week</span>
          )}
        </div>
        <div className="flex items-end justify-between gap-1.5">
          {weekActivity.map((d, i) => {
            const isToday = i === todayIdx;
            const isActive = activeDay === i;
            return (
              <div
                key={d.day}
                className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
              >
                <button
                  type="button"
                  onClick={() => setActiveDay((c) => (c === i ? null : i))}
                  aria-pressed={isActive}
                  title={`${d.hours}h - ${d.tasks} tasks`}
                  className={cn(
                    "group relative w-full flex flex-col items-center justify-end gap-1 py-2 rounded-full min-h-[96px] transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50",
                    isActive
                      ? "bg-primary/25 ring-2 ring-primary/60"
                      : isToday
                      ? "bg-primary/15 ring-1 ring-primary/30"
                      : "bg-white/5"
                  )}
                >
                  {d.items.map((dot, di) => (
                    <span
                      key={di}
                      className={cn("rounded-full block", dot.color)}
                      style={{
                        width: `${dot.size}px`,
                        height: `${dot.size}px`,
                        opacity: 0.85,
                      }}
                    />
                  ))}
                  <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-medium glass-strong opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {d.hours}h - {d.tasks} tasks
                  </span>
                </button>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isActive
                      ? "text-primary"
                      : isToday
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last actions */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Last actions
          </p>
        </div>
        <div className="flex items-center gap-1 mb-3">
          {(["all", "completed", "in_progress"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActionFilter(f)}
              aria-pressed={actionFilter === f}
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full transition-colors",
                actionFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              )}
            >
              {f === "all" ? "All" : f === "completed" ? "Done" : "Active"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filteredRecent.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No matching activity.
            </p>
          ) : (
            filteredRecent.map((r, i) => (
              <button
                key={i}
                onClick={() => toast(`${r.who} — ${r.what} ${r.target}`)}
                className="w-full flex items-start gap-3 -mx-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(r.who)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground truncate">
                      {r.who}
                    </p>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0",
                        r.status === "completed"
                          ? "bg-upflow-success/20 text-upflow-success"
                          : "bg-upflow-warning/20 text-upflow-warning"
                      )}
                    >
                      {r.status === "completed" ? "Completed" : "In progress"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug truncate">
                    {r.what} {r.target}
                  </p>
                  <p className="text-[11px] text-muted-foreground/90 mt-0.5">
                    {r.when}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
        <button
          onClick={() => toast("All activity view coming soon")}
          className="text-xs text-primary hover:text-primary/80 mt-3"
        >
          View all →
        </button>
      </div>
    </aside>
  );
}

function TaskDetailModal({
  task,
  updating,
  onClose,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  updating: boolean;
  onClose: () => void;
  onStatusChange: (task: Task, status: Task["status"]) => void;
  onDelete: (task: Task) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = `task-modal-title-${task.id}`;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {task.project?.name || "Task"}
            </p>
            <h3 id={titleId} className="mt-1 text-lg font-bold text-foreground">{task.title}</h3>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "px-2 py-1 rounded-full font-medium",
              priorityColor(task.priority)
            )}
          >
            {task.priority}
          </span>
          <span className="px-2 py-1 rounded-full bg-white/5 text-foreground/80 capitalize">
            {task.status.replace("_", " ")}
          </span>
          {task.due_date && (
            <span
              className={cn(
                "px-2 py-1 rounded-full bg-white/5",
                isOverdue(task.due_date) && task.status !== "done"
                  ? "text-upflow-danger"
                  : "text-foreground/80"
              )}
            >
              Due {formatDate(task.due_date)}
            </span>
          )}
        </div>
        {task.description && (
          <p className="mt-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        )}
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <button
            onClick={() => onStatusChange(task, "todo")}
            disabled={updating || task.status === "todo"}
            className="text-xs font-medium py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            To do
          </button>
          <button
            onClick={() => onStatusChange(task, "in_progress")}
            disabled={updating || task.status === "in_progress"}
            className="text-xs font-medium py-2 rounded-xl bg-upflow-warning/20 text-upflow-warning hover:bg-upflow-warning/30 disabled:opacity-40 transition-colors"
          >
            In progress
          </button>
          <button
            onClick={() => onStatusChange(task, "done")}
            disabled={updating || task.status === "done"}
            className="text-xs font-medium py-2 rounded-xl bg-upflow-success/20 text-upflow-success hover:bg-upflow-success/30 disabled:opacity-40 transition-colors"
          >
            Mark done
          </button>
        </div>
        <button
          onClick={() => {
            if (confirm(`Delete "${task.title}"?`)) onDelete(task);
          }}
          disabled={updating}
          className="mt-3 w-full text-xs font-medium py-2 rounded-xl text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-40 transition-colors"
        >
          Delete task
        </button>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  hint,
  icon,
  tone,
  onClick,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-4 text-left glass transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/60"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
          tone
        )}
      />
      <div className="pointer-events-none absolute -top-8 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start gap-2.5">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg bg-background/40 backdrop-blur flex-shrink-0",
            tone.split(" ").find((c) => c.startsWith("text-")) || "text-foreground"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground leading-tight">
            {label}
          </p>
          <p className="text-[11px] text-foreground/60 leading-snug mt-0.5">
            {hint}
          </p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 mt-1 text-foreground/50 group-hover:text-foreground transition-colors flex-shrink-0" />
      </div>
    </button>
  );
}

function PeopleCard({
  users,
  loading,
}: {
  users: TeamMember[];
  loading: boolean;
}) {
  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-foreground">
          People ({users.length})
        </h3>
        <Link href="/team" className="text-xs text-primary hover:underline">
          View all →
        </Link>
      </div>
      <div className="p-3">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No teammates yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {users.slice(0, 9).map((u) => (
              <Link
                key={u.id}
                href="/team"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {u.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.avatar_url}
                    alt={u.name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(u.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {u.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {u.email}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
