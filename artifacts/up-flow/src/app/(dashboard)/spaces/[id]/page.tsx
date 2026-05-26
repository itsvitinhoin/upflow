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
import { cn, formatDate, priorityColor } from "@/lib/utils";

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
        <div className="p-6">
          <div className="glass rounded-xl p-6 max-w-lg">
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

  return (
    <>
      <Header title={space.name} />
      <div className="p-6 space-y-6">
        <section className="glass rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/15 text-primary flex-shrink-0">
                <Folder className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-foreground truncate">
                  {space.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {space.icon || "Space"} command center
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
          <div className="mt-5 inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
            <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")}>
              Dashboard
            </TabButton>
            <TabButton active={activeTab === "browse"} onClick={() => setActiveTab("browse")}>
              Browse
            </TabButton>
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
      <section className="glass rounded-xl p-6 max-w-lg">
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

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CommandTile
          title="My urgent actions"
          value={command.urgent_actions.count}
          hint="Due, overdue, or high priority"
          icon={<AlertCircle className="w-4 h-4" />}
          onClick={() => onOpenDrawer("urgent_actions")}
        />
        <CommandTile
          title="Team workload"
          value={command.team_workload.count}
          hint="Space workload by member"
          icon={<Users2 className="w-4 h-4" />}
          onClick={() => onOpenDrawer("team_workload")}
        />
        <CommandTile
          title="Time today"
          value={formatSecondsShort(command.time_today.total_seconds)}
          hint={command.time_today.running ? "Timer is running" : "Tracked in this Space"}
          icon={<Timer className="w-4 h-4" />}
          onClick={() => onOpenDrawer("time_today")}
        />
        <CommandTile
          title="Meetings today"
          value={command.meetings_today.count}
          hint="Linked to this Space"
          icon={<CalendarIcon className="w-4 h-4" />}
          onClick={() => onOpenDrawer("meetings_today")}
        />
        <CommandTile
          title="Recent activity"
          value={command.recent_activity.count}
          hint="Space activity trail"
          icon={<Activity className="w-4 h-4" />}
          onClick={() => onOpenDrawer("recent_activity")}
        />
        <CommandTile
          title="Projects at risk"
          value={command.projects_at_risk.count}
          hint="Overdue or stale lists"
          icon={<TrendingDown className="w-4 h-4" />}
          onClick={() => onOpenDrawer("projects_at_risk")}
        />
        <CommandTile
          title="Quick create"
          value={command.quick_create.items.length}
          hint="Task, meeting, project"
          icon={<Command className="w-4 h-4" />}
          onClick={() => onOpenDrawer("quick_create")}
        />
      </section>

      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatusCard
          label="Upcoming Actions"
          value={stats.todo}
          hint="Tasks waiting to start"
          icon={<FolderKanban className="w-5 h-5" />}
          onClick={() => onOpenDrawer("status:todo")}
        />
        <StatusCard
          label="In Progress Actions"
          value={stats.inProgress}
          hint="Currently being worked on"
          icon={<AlertCircle className="w-5 h-5" />}
          onClick={() => onOpenDrawer("status:in_progress")}
        />
        <StatusCard
          label="Completed Actions"
          value={stats.done}
          hint={`${stats.progress}% of total`}
          icon={<CheckCircle2 className="w-5 h-5" />}
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
            emptyText="Due, overdue, and high-priority assigned tasks appear here."
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
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl glass-strong border-l border-white/10 shadow-2xl flex flex-col">
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
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
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
    setTodayLabel(
      now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    );
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
                        title={`${task.title} · ${overdue ? "Overdue" : due.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
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

function CommandTile({
  title,
  value,
  hint,
  icon,
  onClick,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
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
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-left hover:bg-white/[0.06] transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-primary">
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
      <div className="p-6 space-y-6" role="status" aria-busy="true">
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
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
