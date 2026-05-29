"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  Command,
  Folder,
  FolderKanban,
  FolderPlus,
  List,
  ListPlus,
  Plus,
  RefreshCcw,
  Timer,
  TrendingDown,
  Users2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import { FolderDialog, NewListDialog } from "@/components/layout/sidebar/dialogs";
import ScheduleMeetingDialog from "@/components/dashboard/schedule-meeting-dialog";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import type {
  ActivityEvent,
  CalendarEvent,
  Folder as FolderT,
  Project,
  Space,
  Task,
  TeamMember,
  TimeEntry,
} from "@/lib/types";
import type { DepartmentSpacePreset } from "@/lib/department-spaces";
import {
  cn,
  formatDate,
  formatDateTime as formatBrazilianDateTime,
  formatLongDate,
  formatTime,
  priorityColor,
} from "@/lib/utils";

type ContainerList = Pick<Project, "id" | "name">;
type SpaceTab = "dashboard" | "browse";
type TaskStatus = "todo" | "in_progress" | "done";
type DrawerKind =
  | "urgent_actions"
  | "team_workload"
  | "time_today"
  | "meetings_today"
  | "recent_activity"
  | "projects_at_risk"
  | "quick_create"
  | `status:${TaskStatus}`;

interface SpaceContainerData {
  space: Space;
  folders: FolderT[];
  projects: ContainerList[];
}

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
  quick_create: { items: string[] };
}

interface SpaceDashboardData {
  space: Space;
  department_preset: DepartmentSpacePreset | null;
  tasks: { items: Task[] };
  projects: { items: Project[] };
  users: { items: TeamMember[] };
  calendar_events: { items: CalendarEvent[] };
  activity: { items: ActivityEvent[] };
  time: {
    running: TimeEntry | null;
    week_entries: TimeEntry[];
  };
  command_center: CommandCenterPayload;
}

export default function SpaceContainerPage() {
  const params = useParams();
  const id = (params?.id ?? "") as string;
  const [activeTab, setActiveTab] = useState<SpaceTab>("dashboard");
  const [data, setData] = useState<SpaceContainerData | null>(null);
  const [dashboard, setDashboard] = useState<SpaceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [notFoundState, setNotFoundState] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const [updatingTask, setUpdatingTask] = useState(false);

  const loadContainer = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${id}`);
      if (res.status === 404) {
        setNotFoundState(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      setData((await res.json()) as SpaceContainerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await fetch(`/api/spaces/${id}/dashboard`);
      if (res.status === 404) {
        setNotFoundState(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load dashboard");
      setDashboard((await res.json()) as SpaceDashboardData);
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setDashboardLoading(false);
    }
  };

  const refreshAfterCreate = () => {
    window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
    loadContainer();
    loadDashboard();
  };

  useEffect(() => {
    if (!id) return;
    setActiveTab("dashboard");
    loadContainer();
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const firstProjectId = dashboard?.projects.items[0]?.id ?? null;

  const openTaskCreate = () => {
    if (!firstProjectId) {
      toast.error("Create a list in this Space before adding tasks");
      return;
    }
    setShowNewTask(true);
  };

  const openMeetingCreate = () => {
    if (!firstProjectId) {
      toast.error("Create a list in this Space before adding meetings");
      return;
    }
    setShowSchedule(true);
  };

  const updateTaskStatus = async (task: Task, status: TaskStatus) => {
    setUpdatingTask(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(`Task moved to ${status.replace("_", " ")}`);
      loadDashboard();
    } catch {
      toast.error("Could not update task");
    } finally {
      setUpdatingTask(false);
    }
  };

  if (notFoundState) {
    notFound();
  }

  if (loading) {
    return <ContainerSkeleton title="Space" />;
  }

  if (error || !data) {
    return (
      <>
        <Header title="Space" />
        <div className="p-4 sm:p-6">
          <div className="max-w-lg rounded-xl p-4 glass sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Couldn&apos;t load this Space
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Something went wrong while fetching the Space. Try again in a moment.
            </p>
            <button
              onClick={() => {
                loadContainer();
                loadDashboard();
              }}
              className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg"
            >
              <RefreshCcw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  const { space, folders, projects } = data;
  const rootFolders = folders.filter((folder) => !folder.parent_id);
  const empty = rootFolders.length === 0 && projects.length === 0;
  const departmentPreset = dashboard?.department_preset ?? null;
  const departmentTheme = getDepartmentDashboardTheme(departmentPreset?.department_key);

  return (
    <>
      <Header title={space.name} />
      <div className="space-y-6 overflow-x-hidden p-4 sm:p-6">
        <section
          className={cn(
            "relative overflow-hidden rounded-xl border p-5 shadow-2xl",
            departmentTheme.container,
          )}
        >
          <div className={cn("absolute inset-x-0 top-0 h-1", departmentTheme.accent)} />
          <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-black/20 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div
                className={cn(
                  "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border text-2xl shadow-lg",
                  departmentTheme.icon,
                )}
              >
                {departmentPreset?.emoji ?? <Folder className="h-7 w-7" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                      departmentTheme.badge,
                    )}
                  >
                    Department dashboard
                  </span>
                  {departmentPreset && (
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {departmentPreset.default_task_template_id.replace("_", " ")} template
                    </span>
                  )}
                </div>
                <h2 className="mt-3 truncate text-2xl font-bold text-foreground sm:text-3xl">
                  {space.name}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {departmentPreset?.description ?? `${space.icon || "Space"} command center`}
                </p>
              </div>
            </div>
            <div className="relative flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowNewFolder(true)}
                className="inline-flex items-center gap-2 border border-white/10 text-foreground hover:bg-white/10 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                New folder
              </button>
              <button
                onClick={() => setShowNewList(true)}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <ListPlus className="w-4 h-4" />
                New list
              </button>
            </div>
          </div>
          <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">
            <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")}>
              Dashboard
            </TabButton>
            <TabButton active={activeTab === "browse"} onClick={() => setActiveTab("browse")}>
              Browse
            </TabButton>
            </div>
            {departmentPreset && (
              <p className="text-xs text-muted-foreground">
                Starter lists: {departmentPreset.starter_lists.slice(0, 4).join(" · ")}
              </p>
            )}
          </div>
        </section>

        {activeTab === "dashboard" ? (
          <SpaceDashboard
            data={dashboard}
            loading={dashboardLoading}
            error={dashboardError}
            updatingTask={updatingTask}
            onRetry={loadDashboard}
            onOpenDrawer={setDrawer}
            onCreateTask={openTaskCreate}
            onCreateMeeting={openMeetingCreate}
            onCreateProject={() => setShowNewProject(true)}
            onTaskStatusChange={updateTaskStatus}
          />
        ) : (
          <BrowseTab
            empty={empty}
            rootFolders={rootFolders}
            projects={projects}
            onNewFolder={() => setShowNewFolder(true)}
            onNewList={() => setShowNewList(true)}
          />
        )}
      </div>

      {showNewFolder && (
        <FolderDialog
          mode="create"
          target={{ kind: "space", space }}
          onClose={() => setShowNewFolder(false)}
          onSaved={() => {
            setShowNewFolder(false);
            refreshAfterCreate();
          }}
        />
      )}

      {showNewList && (
        <NewListDialog
          target={{ kind: "space", space }}
          onClose={() => setShowNewList(false)}
          onSaved={() => {
            setShowNewList(false);
            refreshAfterCreate();
          }}
        />
      )}

      <NewProjectDialog
        open={showNewProject}
        defaultSpaceId={space.id}
        onClose={() => setShowNewProject(false)}
        onCreated={() => {
          setShowNewProject(false);
          refreshAfterCreate();
          toast.success("Project created");
        }}
      />

      <NewTaskDialog
        open={showNewTask}
        projectId={firstProjectId ?? undefined}
        defaultTemplateId={dashboard?.department_preset?.default_task_template_id}
        onClose={() => setShowNewTask(false)}
        onCreated={() => {
          setShowNewTask(false);
          loadDashboard();
          toast.success("Task created");
        }}
      />

      <ScheduleMeetingDialog
        open={showSchedule}
        defaultProjectId={firstProjectId}
        onClose={() => setShowSchedule(false)}
        onScheduled={() => {
          setShowSchedule(false);
          loadDashboard();
        }}
      />

      {drawer && dashboard && (
        <SpaceDashboardDrawer
          kind={drawer}
          data={dashboard}
          updatingTask={updatingTask}
          onClose={() => setDrawer(null)}
          onCreateTask={openTaskCreate}
          onCreateMeeting={openMeetingCreate}
          onCreateProject={() => setShowNewProject(true)}
          onTaskStatusChange={updateTaskStatus}
        />
      )}
    </>
  );
}

function SpaceDashboard({
  data,
  loading,
  error,
  updatingTask,
  onRetry,
  onOpenDrawer,
  onCreateTask,
  onCreateMeeting,
  onCreateProject,
  onTaskStatusChange,
}: {
  data: SpaceDashboardData | null;
  loading: boolean;
  error: string | null;
  updatingTask: boolean;
  onRetry: () => void;
  onOpenDrawer: (kind: DrawerKind) => void;
  onCreateTask: () => void;
  onCreateMeeting: () => void;
  onCreateProject: () => void;
  onTaskStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const stats = useMemo(() => {
    const tasks = data?.tasks.items ?? [];
    const done = tasks.filter((task) => task.status === "done").length;
    const todo = tasks.filter((task) => task.status === "todo").length;
    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    return {
      todo,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      done,
      progress,
      total: tasks.length,
    };
  }, [data]);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <section className="max-w-lg rounded-xl p-4 glass sm:p-6">
        <h3 className="text-base font-semibold text-foreground">
          Couldn&apos;t load dashboard
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Space records are unavailable right now.
        </p>
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg"
        >
          <RefreshCcw className="w-4 h-4" />
          Retry
        </button>
      </section>
    );
  }

  const command = data.command_center;
  const labels = data.department_preset?.dashboard_focus_labels;
  const overloadedCount = command.team_workload.items.filter(
    (item) => item.state === "late" || item.state === "overloaded",
  ).length;
  const dashboardStatus =
    command.projects_at_risk.count > 0 || command.urgent_actions.count > 0
      ? "Needs attention"
      : "On track";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(124,92,255,0.18),rgba(16,185,129,0.08),rgba(245,158,11,0.06))]">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {data.department_preset?.name ?? "Space"} dashboard
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  dashboardStatus === "On track"
                    ? "bg-upflow-success/15 text-upflow-success"
                    : "bg-upflow-warning/15 text-upflow-warning",
                )}
              >
                {dashboardStatus}
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
              {data.space.name} command dashboard
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {data.department_preset?.description ??
                "Live Space metrics for tasks, meetings, tracked time, risk, and activity."}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <HeroMetric
                label="Completion"
                value={`${stats.progress}%`}
                detail={`${stats.done} of ${stats.total} tasks`}
              />
              <HeroMetric
                label="Open work"
                value={stats.todo + stats.inProgress}
                detail={`${stats.inProgress} in progress`}
              />
              <HeroMetric
                label="Team flags"
                value={overloadedCount}
                detail="Late or overloaded"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Today&apos;s pulse
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Focus on what can move this Space forward now.
                </p>
              </div>
              <button
                onClick={onCreateTask}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New task
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              <PulseRow
                label="Urgent actions"
                value={command.urgent_actions.count}
                tone="danger"
                onClick={() => onOpenDrawer("urgent_actions")}
              />
              <PulseRow
                label="Meetings today"
                value={command.meetings_today.count}
                tone="primary"
                onClick={() => onOpenDrawer("meetings_today")}
              />
              <PulseRow
                label="Time tracked"
                value={formatSecondsShort(command.time_today.total_seconds)}
                tone="success"
                onClick={() => onOpenDrawer("time_today")}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CommandTile
          title="My urgent actions"
          value={command.urgent_actions.count}
          hint={labels?.urgent ?? "Due, overdue, or high priority"}
          icon={<AlertCircle className="w-4 h-4" />}
          tone="danger"
          onClick={() => onOpenDrawer("urgent_actions")}
        />
        <CommandTile
          title="Team workload"
          value={command.team_workload.count}
          hint={labels?.workload ?? "Space workload by member"}
          icon={<Users2 className="w-4 h-4" />}
          tone="primary"
          onClick={() => onOpenDrawer("team_workload")}
        />
        <CommandTile
          title="Time today"
          value={formatSecondsShort(command.time_today.total_seconds)}
          hint={
            command.time_today.running
              ? "Timer is running"
              : (labels?.time ?? "Tracked in this Space")
          }
          icon={<Timer className="w-4 h-4" />}
          tone="success"
          onClick={() => onOpenDrawer("time_today")}
        />
        <CommandTile
          title="Meetings today"
          value={command.meetings_today.count}
          hint={labels?.meetings ?? "Linked to this Space"}
          icon={<CalendarIcon className="w-4 h-4" />}
          tone="blue"
          onClick={() => onOpenDrawer("meetings_today")}
        />
        <CommandTile
          title="Recent activity"
          value={command.recent_activity.count}
          hint={labels?.activity ?? "Space activity trail"}
          icon={<Activity className="w-4 h-4" />}
          tone="violet"
          onClick={() => onOpenDrawer("recent_activity")}
        />
        <CommandTile
          title="Projects at risk"
          value={command.projects_at_risk.count}
          hint={labels?.risk ?? "Overdue or stale lists"}
          icon={<TrendingDown className="w-4 h-4" />}
          tone="warning"
          onClick={() => onOpenDrawer("projects_at_risk")}
        />
        <CommandTile
          title="Quick create"
          value={command.quick_create.items.length}
          hint={
            data.department_preset
              ? `${data.department_preset.name} task, meeting, project`
              : "Task, meeting, project"
          }
          icon={<Command className="w-4 h-4" />}
          tone="teal"
          onClick={() => onOpenDrawer("quick_create")}
        />
      </section>

      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatusCard
          label="Upcoming Actions"
          value={stats.todo}
          hint="Tasks waiting to start"
          icon={<FolderKanban className="w-5 h-5" />}
          tone="warning"
          onClick={() => onOpenDrawer("status:todo")}
        />
        <StatusCard
          label="In Progress Actions"
          value={stats.inProgress}
          hint="Currently being worked on"
          icon={<AlertCircle className="w-5 h-5" />}
          tone="primary"
          onClick={() => onOpenDrawer("status:in_progress")}
        />
        <StatusCard
          label="Completed Actions"
          value={stats.done}
          hint={`${stats.progress}% of total`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="success"
          onClick={() => onOpenDrawer("status:done")}
        />
      </section>

      <section className="glass rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Space progress</p>
            <h3 className="mt-1 text-2xl font-bold text-foreground">{stats.progress}%</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.done} of {stats.total} tasks complete
            </p>
          </div>
          <button
            onClick={onCreateTask}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            New task
          </button>
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-upflow-success transition-all"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
      </section>

      <SpaceTaskTimeline tasks={data.tasks.items} onCreateTask={onCreateTask} />

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="glass rounded-xl overflow-hidden">
          <SectionHeader
            title="Urgent actions"
            actionLabel="View all"
            onAction={() => onOpenDrawer("urgent_actions")}
          />
          <RecordList
            emptyTitle="No urgent actions"
            emptyText={
              labels?.empty ?? "Due, overdue, and high-priority assigned tasks appear here."
            }
          >
            {command.urgent_actions.items.slice(0, 5).map((task) => (
              <TaskRecord
                key={task.id}
                task={task}
                updating={updatingTask}
                onStatusChange={onTaskStatusChange}
              />
            ))}
          </RecordList>
        </div>
        <div className="glass rounded-xl overflow-hidden">
          <SectionHeader
            title="Quick create"
            actionLabel="Open"
            onAction={() => onOpenDrawer("quick_create")}
          />
          <div className="p-4 grid gap-2">
            <QuickCreateButton icon={<CheckSquare className="w-4 h-4" />} onClick={onCreateTask}>
              New task
            </QuickCreateButton>
            <QuickCreateButton icon={<CalendarIcon className="w-4 h-4" />} onClick={onCreateMeeting}>
              New meeting
            </QuickCreateButton>
            <QuickCreateButton icon={<FolderPlus className="w-4 h-4" />} onClick={onCreateProject}>
              New project
            </QuickCreateButton>
          </div>
        </div>
      </section>
    </div>
  );
}

function getDepartmentDashboardTheme(key?: DepartmentSpacePreset["department_key"]) {
  const fallback = {
    container: "border-white/10 bg-card/70",
    icon: "border-white/10 bg-primary/15 text-primary",
    badge: "border-primary/30 bg-primary/10 text-primary",
    accent: "bg-primary",
  };
  if (!key) return fallback;

  const themes: Record<
    DepartmentSpacePreset["department_key"],
    typeof fallback
  > = {
    comercial: {
      container: "border-amber-400/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(124,92,255,0.08),rgba(255,255,255,0.03))]",
      icon: "border-amber-300/30 bg-amber-400/15 text-amber-200",
      badge: "border-amber-300/30 bg-amber-400/10 text-amber-200",
      accent: "bg-amber-300",
    },
    marketing_b2b: {
      container: "border-sky-400/25 bg-[linear-gradient(135deg,rgba(56,189,248,0.14),rgba(124,92,255,0.1),rgba(255,255,255,0.03))]",
      icon: "border-sky-300/30 bg-sky-400/15 text-sky-200",
      badge: "border-sky-300/30 bg-sky-400/10 text-sky-200",
      accent: "bg-sky-300",
    },
    marketing_b2c: {
      container: "border-rose-400/25 bg-[linear-gradient(135deg,rgba(251,113,133,0.15),rgba(245,158,11,0.08),rgba(255,255,255,0.03))]",
      icon: "border-rose-300/30 bg-rose-400/15 text-rose-200",
      badge: "border-rose-300/30 bg-rose-400/10 text-rose-200",
      accent: "bg-rose-300",
    },
    creative_design: {
      container: "border-fuchsia-400/25 bg-[linear-gradient(135deg,rgba(217,70,239,0.15),rgba(124,92,255,0.12),rgba(255,255,255,0.03))]",
      icon: "border-fuchsia-300/30 bg-fuchsia-400/15 text-fuchsia-200",
      badge: "border-fuchsia-300/30 bg-fuchsia-400/10 text-fuchsia-200",
      accent: "bg-fuchsia-300",
    },
    finance: {
      container: "border-emerald-400/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.15),rgba(245,158,11,0.07),rgba(255,255,255,0.03))]",
      icon: "border-emerald-300/30 bg-emerald-400/15 text-emerald-200",
      badge: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
      accent: "bg-emerald-300",
    },
    production: {
      container: "border-orange-400/25 bg-[linear-gradient(135deg,rgba(251,146,60,0.15),rgba(239,68,68,0.08),rgba(255,255,255,0.03))]",
      icon: "border-orange-300/30 bg-orange-400/15 text-orange-200",
      badge: "border-orange-300/30 bg-orange-400/10 text-orange-200",
      accent: "bg-orange-300",
    },
    technical_support: {
      container: "border-cyan-400/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.15),rgba(59,130,246,0.1),rgba(255,255,255,0.03))]",
      icon: "border-cyan-300/30 bg-cyan-400/15 text-cyan-200",
      badge: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200",
      accent: "bg-cyan-300",
    },
    general_admin: {
      container: "border-slate-300/20 bg-[linear-gradient(135deg,rgba(148,163,184,0.15),rgba(124,92,255,0.08),rgba(255,255,255,0.03))]",
      icon: "border-slate-300/25 bg-slate-300/15 text-slate-200",
      badge: "border-slate-300/25 bg-slate-300/10 text-slate-200",
      accent: "bg-slate-300",
    },
  };
  return themes[key];
}

function BrowseTab({
  empty,
  rootFolders,
  projects,
  onNewFolder,
  onNewList,
}: {
  empty: boolean;
  rootFolders: FolderT[];
  projects: ContainerList[];
  onNewFolder: () => void;
  onNewList: () => void;
}) {
  if (empty) {
    return (
      <section className="glass rounded-xl p-10 text-center">
        <Folder className="w-10 h-10 mx-auto text-muted-foreground" />
        <h3 className="mt-4 text-base font-semibold text-foreground">
          This Space is empty
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a folder or list to start organizing work here.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            onClick={onNewFolder}
            className="inline-flex items-center gap-2 border border-white/10 text-foreground hover:bg-white/10 text-sm font-medium px-4 py-2 rounded-lg"
          >
            <FolderPlus className="w-4 h-4" />
            New folder
          </button>
          <button
            onClick={onNewList}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg"
          >
            <ListPlus className="w-4 h-4" />
            New list
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {rootFolders.length > 0 && (
        <ContainerSection title="Folders">
          {rootFolders.map((folder) => (
            <ContainerTile
              key={folder.id}
              href={`/folders/${folder.id}`}
              icon={<Folder className="w-5 h-5" />}
              name={folder.name}
            />
          ))}
        </ContainerSection>
      )}

      {projects.length > 0 && (
        <ContainerSection title="Lists">
          {projects.map((project) => (
            <ContainerTile
              key={project.id}
              href={`/projects/${project.id}`}
              icon={<List className="w-5 h-5" />}
              name={project.name}
            />
          ))}
        </ContainerSection>
      )}
    </div>
  );
}

function SpaceDashboardDrawer({
  kind,
  data,
  updatingTask,
  onClose,
  onCreateTask,
  onCreateMeeting,
  onCreateProject,
  onTaskStatusChange,
}: {
  kind: DrawerKind;
  data: SpaceDashboardData;
  updatingTask: boolean;
  onClose: () => void;
  onCreateTask: () => void;
  onCreateMeeting: () => void;
  onCreateProject: () => void;
  onTaskStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const status = kind.startsWith("status:") ? (kind.split(":")[1] as TaskStatus) : null;
  const statusTasks = status
    ? data.tasks.items.filter((task) => task.status === status)
    : [];
  const title = status ? statusTitle(status) : drawerTitle(kind);

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <aside className="absolute right-0 top-0 flex h-dvh w-full max-w-xl flex-col border-l border-white/10 shadow-2xl glass-strong">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Space dashboard</p>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {kind === "urgent_actions" && (
            <RecordList
              emptyTitle="No urgent actions"
              emptyText="Due, overdue, and high-priority assigned tasks appear here."
            >
              {data.command_center.urgent_actions.items.map((task) => (
                <TaskRecord
                  key={task.id}
                  task={task}
                  updating={updatingTask}
                  onStatusChange={onTaskStatusChange}
                />
              ))}
            </RecordList>
          )}

          {status && (
            <RecordList
              emptyTitle={`No ${status.replace("_", " ")} tasks`}
              emptyText="Tasks with this status will appear here."
            >
              {statusTasks.map((task) => (
                <TaskRecord
                  key={task.id}
                  task={task}
                  updating={updatingTask}
                  onStatusChange={onTaskStatusChange}
                />
              ))}
            </RecordList>
          )}

          {kind === "team_workload" && (
            <RecordList emptyTitle="No team workload" emptyText="Assigned Space tasks appear here.">
              {data.command_center.team_workload.items.map((item) => (
                <div key={item.user.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.user.name}</p>
                      <p className="text-xs text-muted-foreground">{item.user.email}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-xs capitalize text-muted-foreground">
                      {item.state}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <Metric label="Open" value={item.open_tasks} />
                    <Metric label="Overdue" value={item.overdue_tasks} />
                    <Metric label="Today" value={formatSecondsShort(item.tracked_seconds_today)} />
                  </div>
                </div>
              ))}
            </RecordList>
          )}

          {kind === "time_today" && (
            <RecordList emptyTitle="No time tracked today" emptyText="Space-linked time entries appear here.">
              {data.command_center.time_today.entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {entry.description || entry.task?.title || entry.project?.name || "Time entry"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.project?.name || "No project"} · {formatDateTime(entry.started_at)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatSecondsShort(entrySeconds(entry))}
                    </span>
                  </div>
                </div>
              ))}
            </RecordList>
          )}

          {kind === "meetings_today" && (
            <RecordList emptyTitle="No meetings today" emptyText="Space-linked calendar events appear here.">
              {data.command_center.meetings_today.items.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(event.starts_at)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
              ))}
            </RecordList>
          )}

          {kind === "recent_activity" && (
            <RecordList emptyTitle="No recent activity" emptyText="Space activity appears here.">
              {data.command_center.recent_activity.items.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-foreground">{humanize(event.type)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.actor?.name || "System"} · {formatDateTime(event.created_at)}
                  </p>
                </div>
              ))}
            </RecordList>
          )}

          {kind === "projects_at_risk" && (
            <RecordList emptyTitle="No projects at risk" emptyText="Overdue or stale Space projects appear here.">
              {data.command_center.projects_at_risk.items.map(({ project, reasons }) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]"
                >
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{reasons.join(" · ")}</p>
                </Link>
              ))}
            </RecordList>
          )}

          {kind === "quick_create" && (
            <div className="grid gap-2">
              <QuickCreateButton icon={<CheckSquare className="w-4 h-4" />} onClick={onCreateTask}>
                New task
              </QuickCreateButton>
              <QuickCreateButton icon={<CalendarIcon className="w-4 h-4" />} onClick={onCreateMeeting}>
                New meeting
              </QuickCreateButton>
              <QuickCreateButton icon={<FolderPlus className="w-4 h-4" />} onClick={onCreateProject}>
                New project
              </QuickCreateButton>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

type TaskTimelineItem = {
  task: Task;
  due: Date;
  start: number;
  end: number;
  overdue: boolean;
};

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function taskDueHour(date: Date) {
  const hour = date.getHours();
  const minute = date.getMinutes();
  if (hour === 0 && minute === 0) return 9;
  return hour + minute / 60;
}

function clampTaskTimelineBlock(start: number, duration = 0.75) {
  const clampedStart = Math.max(8, Math.min(18.75, start));
  const clampedEnd = Math.max(clampedStart + 0.5, Math.min(19, clampedStart + duration));
  return { start: clampedStart, end: clampedEnd };
}

function taskTimelineClass(task: Task, overdue: boolean) {
  if (overdue) return "bg-upflow-danger/30 border-l-upflow-danger text-upflow-danger";
  if (task.status === "done") return "bg-upflow-success/30 border-l-upflow-success text-upflow-success";
  if (task.status === "in_progress") return "bg-primary/35 border-l-primary text-primary";
  if (task.priority === "high") return "bg-upflow-warning/30 border-l-upflow-warning text-upflow-warning";
  return "bg-white/10 border-l-white/40 text-foreground/80";
}

function SpaceTaskTimeline({
  tasks,
  onCreateTask,
}: {
  tasks: Task[];
  onCreateTask: () => void;
}) {
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i);
  const totalHours = 11;
  const [currentHour, setCurrentHour] = useState<number | null>(null);
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    const now = new Date();
    setCurrentHour(now.getHours());
    setTodayLabel(formatLongDate(now));
  }, []);

  const timelineItems = useMemo<TaskTimelineItem[]>(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    return tasks
      .filter((task) => task.due_date)
      .map((task) => {
        const due = new Date(task.due_date as string);
        const overdue = task.status !== "done" && due < todayStart;
        if (!overdue && !isSameLocalDay(due, now)) return null;
        const block = clampTaskTimelineBlock(overdue ? 8 : taskDueHour(due));
        return { task, due, overdue, ...block };
      })
      .filter((item): item is TaskTimelineItem => Boolean(item))
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        if (a.start !== b.start) return a.start - b.start;
        return a.task.position - b.task.position;
      })
      .slice(0, 8);
  }, [tasks]);

  const overdueCount = timelineItems.filter((item) => item.overdue).length;
  const dueTodayCount = timelineItems.length - overdueCount;

  const formatHour = (n: number) =>
    n > 12 ? `${n - 12}pm` : n === 12 ? "12pm" : `${n}am`;

  return (
    <section className="glass rounded-xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Task timeline</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span suppressHydrationWarning>{todayLabel || "\u00A0"}</span>
            {timelineItems.length > 0 && (
              <>
                {" · "}
                <span>{dueTodayCount} due today</span>
                {overdueCount > 0 && (
                  <>
                    {" · "}
                    <span className="text-upflow-danger">{overdueCount} overdue</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <button
          onClick={onCreateTask}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New task
        </button>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[900px]">
          <div className="flex items-center gap-1 pb-3 pl-[188px]">
            {hours.map((h) => {
              const isCurrent = h === currentHour;
              return (
                <div
                  key={h}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 text-muted-foreground",
                  )}
                >
                  {formatHour(h)}
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            {timelineItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center">
                <p className="text-sm font-medium text-foreground">
                  No tasks scheduled today
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tasks with due dates in this Space will appear here.
                </p>
              </div>
            ) : (
              timelineItems.map(({ task, due, start, end, overdue }) => {
                const dimCurrent =
                  currentHour !== null && (end < currentHour || start > currentHour + 1);
                return (
                  <Link
                    key={task.id}
                    href={`/projects/${task.project_id}`}
                    className="group flex items-center gap-3 rounded-lg p-1 -mx-1 transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <div className="flex w-[176px] flex-shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          overdue
                            ? "bg-upflow-danger"
                            : task.status === "done"
                              ? "bg-upflow-success"
                              : task.status === "in_progress"
                                ? "bg-primary"
                                : "bg-white/40",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground group-hover:text-primary">
                          {task.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {task.project?.name || "List"} · {overdue ? "Overdue" : formatDate(task.due_date)}
                        </p>
                      </div>
                    </div>
                    <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-white/5">
                      <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-12">
                        {hours.map((h) => (
                          <div
                            key={h}
                            className={cn(
                              "border-r border-white/5 last:border-r-0",
                              h === currentHour && "bg-primary/10",
                            )}
                          />
                        ))}
                      </div>
                      <div
                        title={`${task.title} · ${overdue ? "Overdue" : formatTime(due)}`}
                        className={cn(
                          "absolute top-1 bottom-1 flex items-center rounded-md border-l-2 px-2 text-[10px] font-medium transition-opacity",
                          taskTimelineClass(task, overdue),
                          dimCurrent && "opacity-70",
                        )}
                        style={{
                          left: `calc(${((start - 8) / totalHours) * 100}% + 2px)`,
                          width: `calc(${Math.max(((end - start) / totalHours) * 100, 5)}% - 4px)`,
                        }}
                      >
                        <span className="truncate">
                          {overdue ? "Overdue" : statusLabel(task.status)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskRecord({
  task,
  updating,
  onStatusChange,
}: {
  task: Task;
  updating: boolean;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/projects/${task.project_id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground hover:text-primary truncate">
            {task.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground truncate">
            {task.project?.name || "Project"} · {task.due_date ? formatDate(task.due_date) : "No due date"}
          </p>
        </Link>
        <span className={cn("text-xs font-medium", priorityColor(task.priority))}>
          {task.priority}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["todo", "in_progress", "done"] as TaskStatus[]).map((status) => (
          <button
            key={status}
            disabled={updating || task.status === status}
            onClick={() => onStatusChange(task, status)}
            className={cn(
              "rounded-md border border-white/10 px-2.5 py-1 text-xs transition-colors",
              task.status === status
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-white/10 hover:text-foreground",
            )}
          >
            {statusLabel(status)}
          </button>
        ))}
      </div>
    </div>
  );
}

type DashboardTone = "primary" | "success" | "warning" | "danger" | "blue" | "violet" | "teal";

function toneClasses(tone: DashboardTone) {
  const tones: Record<DashboardTone, { border: string; icon: string; text: string; bar: string }> = {
    primary: {
      border: "border-primary/35 hover:border-primary/60",
      icon: "bg-primary/15 text-primary",
      text: "text-primary",
      bar: "bg-primary",
    },
    success: {
      border: "border-upflow-success/30 hover:border-upflow-success/55",
      icon: "bg-upflow-success/15 text-upflow-success",
      text: "text-upflow-success",
      bar: "bg-upflow-success",
    },
    warning: {
      border: "border-upflow-warning/30 hover:border-upflow-warning/55",
      icon: "bg-upflow-warning/15 text-upflow-warning",
      text: "text-upflow-warning",
      bar: "bg-upflow-warning",
    },
    danger: {
      border: "border-upflow-danger/30 hover:border-upflow-danger/55",
      icon: "bg-upflow-danger/15 text-upflow-danger",
      text: "text-upflow-danger",
      bar: "bg-upflow-danger",
    },
    blue: {
      border: "border-sky-400/25 hover:border-sky-400/50",
      icon: "bg-sky-400/15 text-sky-300",
      text: "text-sky-300",
      bar: "bg-sky-300",
    },
    violet: {
      border: "border-violet-400/25 hover:border-violet-400/50",
      icon: "bg-violet-400/15 text-violet-300",
      text: "text-violet-300",
      bar: "bg-violet-300",
    },
    teal: {
      border: "border-teal-400/25 hover:border-teal-400/50",
      icon: "bg-teal-400/15 text-teal-300",
      text: "text-teal-300",
      bar: "bg-teal-300",
    },
  };
  return tones[tone];
}

function HeroMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function PulseRow({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  tone: DashboardTone;
  onClick: () => void;
}) {
  const color = toneClasses(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07]",
        color.border,
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className={cn("h-2 w-2 rounded-full", color.bar)} />
        {label}
      </span>
      <span className={cn("text-sm font-semibold", color.text)}>{value}</span>
    </button>
  );
}

function CommandTile({
  title,
  value,
  hint,
  icon,
  tone = "primary",
  onClick,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  tone?: DashboardTone;
  onClick: () => void;
}) {
  const color = toneClasses(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.06]",
        color.border,
      )}
    >
      <span className={cn("absolute inset-x-0 top-0 h-0.5", color.bar)} />
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", color.icon)}>
          {icon}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}

function StatusCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  tone?: DashboardTone;
  onClick: () => void;
}) {
  const color = toneClasses(tone);
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white/[0.03] p-5 text-left transition-colors hover:bg-white/[0.06]",
        color.border,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", color.icon)}>
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <button onClick={onAction} className="text-xs text-primary hover:underline">
        {actionLabel}
      </button>
    </div>
  );
}

function RecordList({
  children,
  emptyTitle,
  emptyText,
}: {
  children: React.ReactNode;
  emptyTitle: string;
  emptyText: string;
}) {
  const childArray = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  if (childArray.length === 0) {
    return <DrawerEmpty title={emptyTitle} text={emptyText} />;
  }
  return <div className="divide-y divide-transparent p-4 space-y-3">{children}</div>;
}

function DrawerEmpty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 p-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function QuickCreateButton({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-white/[0.06]"
    >
      <span className="inline-flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </span>
        {children}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ContainerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function ContainerTile({
  href,
  icon,
  name,
}: {
  href: string;
  icon: React.ReactNode;
  name: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3",
        "hover:bg-white/5 hover:border-white/10 transition-colors",
      )}
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-muted-foreground group-hover:text-foreground">
        {icon}
      </span>
      <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
        {name}
      </span>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <span className="sr-only">Loading dashboard...</span>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function ContainerSkeleton({ title }: { title: string }) {
  return (
    <>
      <Header title={title} />
      <div className="space-y-6 p-4 sm:p-6" role="status" aria-busy="true">
        <span className="sr-only">Loading...</span>
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-white/5 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 bg-white/5 rounded animate-pulse" />
              <div className="h-3 w-36 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <DashboardSkeleton />
      </div>
    </>
  );
}

function drawerTitle(kind: DrawerKind) {
  const titles: Record<Exclude<DrawerKind, `status:${TaskStatus}`>, string> = {
    urgent_actions: "My urgent actions",
    team_workload: "Team workload",
    time_today: "Time today",
    meetings_today: "Meetings today",
    recent_activity: "Recent activity",
    projects_at_risk: "Projects at risk",
    quick_create: "Quick create",
  };
  return titles[kind as Exclude<DrawerKind, `status:${TaskStatus}`>] ?? "Space records";
}

function statusTitle(status: TaskStatus) {
  if (status === "todo") return "Upcoming Actions";
  if (status === "in_progress") return "In Progress Actions";
  return "Completed Actions";
}

function statusLabel(status: TaskStatus) {
  if (status === "todo") return "To do";
  if (status === "in_progress") return "In progress";
  return "Done";
}

function formatSecondsShort(seconds: number) {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function entrySeconds(entry: TimeEntry) {
  if (entry.status === "running") {
    return Math.max(0, Math.floor((Date.now() - new Date(entry.started_at).getTime()) / 1000));
  }
  return entry.duration_seconds;
}

function formatDateTime(value: string) {
  return formatBrazilianDateTime(value);
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
