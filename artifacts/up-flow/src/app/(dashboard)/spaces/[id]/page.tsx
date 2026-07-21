"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  Command,
  Folder,
  FolderKanban,
  FolderPlus,
  ListPlus,
  Plus,
  RefreshCcw,
  Timer,
  TrendingDown,
  UserPlus,
  Users2,
} from "lucide-react";
import { toast } from "sonner";
import InviteDialog from "@/components/dashboard/invite-dialog";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";
import { useAppUser } from "@/components/user-provider";
import { FolderDialog, NewListDialog } from "@/components/layout/sidebar/dialogs";
import ScheduleMeetingDialog from "@/components/dashboard/schedule-meeting-dialog";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import TaskCreateSheet from "@/components/projects/task-create-sheet";
import { BrowseTab, ContainerSkeleton, DashboardSkeleton } from "@/components/spaces/space-browser";
import { CommercialOperationsHub } from "@/components/spaces/commercial-operations-hub";
import { SpaceDashboardDrawer } from "@/components/spaces/space-dashboard-drawer";
import {
  CommandTile,
  HeroMetric,
  PulseRow,
  QuickCreateButton,
  RecordList,
  SectionHeader,
  StatusCard,
  TabButton,
  TaskRecord,
} from "@/components/spaces/space-dashboard-parts";
import { SpaceTaskTimeline } from "@/components/spaces/space-task-timeline";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  formatSecondsShort,
  getDepartmentDashboardTheme,
  type DrawerKind,
  type TaskStatus,
} from "@/components/spaces/space-dashboard-utils";
import type { SpaceContainerData, SpaceDashboardData, SpaceTab } from "@/components/spaces/space-page-types";

export default function SpaceContainerPage() {
  const { t } = useLanguage();
  const user = useAppUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = (params?.id ?? "") as string;
  const tabParam = searchParams?.get("tab") ?? "";
  const focusedListId = searchParams?.get("list") ?? "";
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
  const [showInvite, setShowInvite] = useState(false);
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const [updatingTask, setUpdatingTask] = useState(false);
  const [defaultsEnsuredFor, setDefaultsEnsuredFor] = useState<string | null>(null);
  const canManageWorkspace = Boolean(
    user?.isSuperAdmin ||
      user?.currentRole === "owner" ||
      user?.currentRole === "admin",
  );

  const loadContainer = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${id}`);
      if (res.status === 404) {
        setNotFoundState(true);
        return;
      }
      if (!res.ok) {
        throw new Error(await readSpaceApiError(res, "Could not load this Space. Check your workspace access and try again."));
      }
      setData((await res.json()) as SpaceContainerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this Space. Check your workspace access and try again.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  const loadDashboard = async (options?: { silent?: boolean }) => {
    if (!options?.silent) setDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await fetch(`/api/spaces/${id}/dashboard`);
      if (res.status === 404) {
        setNotFoundState(true);
        return;
      }
      if (!res.ok) {
        throw new Error(await readSpaceApiError(res, "Could not load this Space dashboard yet."));
      }
      setDashboard((await res.json()) as SpaceDashboardData);
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : "Could not load this Space dashboard yet.");
    } finally {
      if (!options?.silent) setDashboardLoading(false);
    }
  };

  const refreshAfterCreate = () => {
    window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
    loadContainer({ silent: true });
    loadDashboard({ silent: true });
  };

  useEffect(() => {
    if (!id) return;
    loadContainer();
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setActiveTab(tabParam === "browse" || focusedListId ? "browse" : "dashboard");
  }, [focusedListId, id, tabParam]);

  useEffect(() => {
    if (
      !id ||
      !canManageWorkspace ||
      !["general_admin", "creative_design"].includes(
        dashboard?.department_preset?.department_key ?? "",
      ) ||
      defaultsEnsuredFor === id
    ) {
      return;
    }

    let cancelled = false;
    setDefaultsEnsuredFor(id);
    fetch(`/api/spaces/${id}/department-defaults`, { method: "POST" })
      .then((res) => {
        if (!res.ok || cancelled) return;
        window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
        loadContainer({ silent: true });
        loadDashboard({ silent: true });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageWorkspace, dashboard?.department_preset?.department_key, defaultsEnsuredFor, id]);

  const firstProjectId = dashboard?.projects.items[0]?.id ?? null;

  const openTaskCreate = () => {
    if (!firstProjectId) {
      toast.error(t("space.createListBeforeTasks"));
      return;
    }
    setShowNewTask(true);
  };

  const openMeetingCreate = () => {
    if (!firstProjectId) {
      toast.error(t("space.createListBeforeMeetings"));
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
      if (!res.ok) {
        throw new Error(await readSpaceApiError(res, "Could not update this task status."));
      }
      toast.success(t("space.taskMoved").replace("{status}", status.replace("_", " ")));
      loadDashboard({ silent: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update task");
    } finally {
      setUpdatingTask(false);
    }
  };

  if (notFoundState) {
    notFound();
  }

  if (loading) {
    return <ContainerSkeleton title={t("space.title")} />;
  }

  if (error || !data) {
    return (
      <>
        <Header title={t("space.title")} />
        <div className="p-4 sm:p-6">
          <div className="max-w-lg rounded-xl p-4 glass sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">
              {t("space.loadErrorTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {error || "Could not load this Space. Check your workspace access and try again."}
            </p>
            <button
              onClick={() => {
                loadContainer();
                loadDashboard();
              }}
              className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg"
            >
              <RefreshCcw className="w-4 h-4" />
              {t("common.retry")}
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
  const workspaceName = space.workspace?.name ?? t("invite.currentWorkspace");
  const canShareWorkspace = canManageWorkspace;

  return (
    <>
      <Header title={space.name} />
      <div className="space-y-6 overflow-x-hidden p-4 sm:p-6">
        <section
          className={cn(
            "relative overflow-hidden rounded-xl border p-5 shadow-sm",
            departmentTheme.container,
          )}
        >
          <div className={cn("absolute inset-x-0 top-0 h-1", departmentTheme.accent)} />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div
                className={cn(
                  "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border text-2xl shadow-sm",
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
                    {t("space.departmentDashboard")}
                  </span>
                  {departmentPreset && (
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      {t("space.templateLabel").replace(
                        "{template}",
                        departmentPreset.default_task_template_id.replace("_", " "),
                      )}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 truncate text-2xl font-bold text-foreground sm:text-3xl">
                  {space.name}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {departmentPreset?.description ??
                    t("space.commandCenterFallback", {
                      icon: space.icon || t("space.defaultIcon"),
                    })}
                </p>
              </div>
            </div>
            <div className="relative flex flex-wrap items-center gap-2">
              {canShareWorkspace && (
                <button
                  onClick={() => setShowInvite(true)}
                  className="inline-flex items-center gap-2 border border-blue-300/20 bg-blue-500/10 text-blue-100 hover:border-blue-300/40 hover:bg-blue-500/15 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  {t("space.shareSpace")}
                </button>
              )}
              <button
                onClick={() => setShowNewFolder(true)}
                className="inline-flex items-center gap-2 border border-white/10 text-foreground hover:bg-white/10 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                {t("folder.newFolder")}
              </button>
              <button
                onClick={() => setShowNewList(true)}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <ListPlus className="w-4 h-4" />
                {t("folder.newList")}
              </button>
            </div>
          </div>
          <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-1">
            <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")}>
              {t("space.dashboardTab")}
            </TabButton>
            <TabButton active={activeTab === "browse"} onClick={() => setActiveTab("browse")}>
              {t("space.browseTab")}
            </TabButton>
            </div>
            {departmentPreset && (
              <p className="text-xs text-muted-foreground">
                {t("space.starterLists").replace(
                  "{lists}",
                  departmentPreset.starter_lists.slice(0, 4).join(" · "),
                )}
              </p>
            )}
          </div>
          <div className="relative mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/65">
                  {t("space.accessTitle")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("space.accessDescription", { workspace: workspaceName })}
                </p>
              </div>
              {canShareWorkspace && (
                <button
                  type="button"
                  onClick={() => setShowInvite(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-300/20 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-500/10 hover:text-white"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {t("space.manageAccess")}
                </button>
              )}
            </div>
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
            focusedProjectId={focusedListId}
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

      <TaskCreateSheet
        open={showNewTask}
        projectId={firstProjectId ?? undefined}
        defaultTemplateId={dashboard?.department_preset?.default_task_template_id}
        onClose={() => setShowNewTask(false)}
        onCreated={() => {
          setShowNewTask(false);
          loadDashboard({ silent: true });
        }}
      />

      <ScheduleMeetingDialog
        open={showSchedule}
        defaultProjectId={firstProjectId}
        onClose={() => setShowSchedule(false)}
        onScheduled={() => {
          setShowSchedule(false);
          loadDashboard({ silent: true });
        }}
      />

      <InviteDialog
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title={t("space.shareSpaceTitle", { space: space.name })}
        description={t("space.shareSpaceDescription", {
          space: space.name,
          workspace: workspaceName,
        })}
        submitLabel={t("invite.submitDefault")}
        successLabel={t("invite.successDefault")}
        workspaceId={space.workspace_id}
        defaultRole="member"
        defaultMode="workspace_access"
        hideMode
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
  const { t } = useLanguage();
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
          {t("space.dashboardLoadErrorTitle")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("space.dashboardLoadErrorBody")}
        </p>
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg"
        >
          <RefreshCcw className="w-4 h-4" />
          {t("common.retry")}
        </button>
      </section>
    );
  }

  if (data.department_preset?.department_key === "comercial") {
    return (
      <CommercialOperationsHub
        data={data}
        updatingTask={updatingTask}
        onOpenDrawer={onOpenDrawer}
        onCreateTask={onCreateTask}
        onTaskStatusChange={onTaskStatusChange}
      />
    );
  }

  const command = data.command_center;
  const labels = data.department_preset?.dashboard_focus_labels;
  const overloadedCount = command.team_workload.items.filter(
    (item) => item.state === "late" || item.state === "overloaded",
  ).length;
  const hasDashboardAttention =
    command.projects_at_risk.count > 0 || command.urgent_actions.count > 0;
  const dashboardStatus = hasDashboardAttention
    ? t("spaceDashboard.needsAttention")
    : t("spaceDashboard.onTrack");

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-white/10 bg-card/75 shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {data.department_preset?.name ?? t("space.title")}{" "}
                {t("spaceDashboard.dashboardSuffix")}
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  !hasDashboardAttention
                    ? "bg-upflow-success/15 text-upflow-success"
                    : "bg-upflow-warning/15 text-upflow-warning",
                )}
              >
                {dashboardStatus}
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
              {t("spaceDashboard.commandDashboard", { space: data.space.name })}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {data.department_preset?.description ??
                t("spaceDashboard.liveMetrics")}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <HeroMetric
                label={t("spaceDashboard.completion")}
                value={`${stats.progress}%`}
                detail={t("spaceDashboard.tasksComplete", {
                  done: stats.done,
                  total: stats.total,
                })}
              />
              <HeroMetric
                label={t("spaceDashboard.openWork")}
                value={stats.todo + stats.inProgress}
                detail={t("spaceDashboard.inProgressDetail", { count: stats.inProgress })}
              />
              <HeroMetric
                label={t("spaceDashboard.teamFlags")}
                value={overloadedCount}
                detail={t("spaceDashboard.teamFlagsDetail")}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("spaceDashboard.todaysPulse")}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {t("spaceDashboard.pulseHint")}
                </p>
              </div>
              <button
                onClick={onCreateTask}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                {t("spaceDashboard.newTask")}
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              <PulseRow
                label={t("spaceDashboard.urgentActions")}
                value={command.urgent_actions.count}
                tone="danger"
                onClick={() => onOpenDrawer("urgent_actions")}
              />
              <PulseRow
                label={t("spaceDashboard.meetingsToday")}
                value={command.meetings_today.count}
                tone="primary"
                onClick={() => onOpenDrawer("meetings_today")}
              />
              <PulseRow
                label={t("spaceDashboard.timeTracked")}
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
          title={t("spaceDashboard.myUrgentActions")}
          value={command.urgent_actions.count}
          hint={labels?.urgent ?? t("spaceDashboard.dueOverdueHighPriority")}
          icon={<AlertCircle className="w-4 h-4" />}
          tone="danger"
          onClick={() => onOpenDrawer("urgent_actions")}
        />
        <CommandTile
          title={t("spaceDashboard.teamWorkload")}
          value={command.team_workload.count}
          hint={labels?.workload ?? t("spaceDashboard.workloadByMember")}
          icon={<Users2 className="w-4 h-4" />}
          tone="primary"
          onClick={() => onOpenDrawer("team_workload")}
        />
        <CommandTile
          title={t("spaceDashboard.timeToday")}
          value={formatSecondsShort(command.time_today.total_seconds)}
          hint={
            command.time_today.running
              ? t("spaceDashboard.timerRunning")
              : (labels?.time ?? t("spaceDashboard.trackedInSpace"))
          }
          icon={<Timer className="w-4 h-4" />}
          tone="success"
          onClick={() => onOpenDrawer("time_today")}
        />
        <CommandTile
          title={t("spaceDashboard.meetingsToday")}
          value={command.meetings_today.count}
          hint={labels?.meetings ?? t("spaceDashboard.linkedToSpace")}
          icon={<CalendarIcon className="w-4 h-4" />}
          tone="blue"
          onClick={() => onOpenDrawer("meetings_today")}
        />
        <CommandTile
          title={t("spaceDashboard.recentActivity")}
          value={command.recent_activity.count}
          hint={labels?.activity ?? t("spaceDashboard.activityTrail")}
          icon={<Activity className="w-4 h-4" />}
          tone="violet"
          onClick={() => onOpenDrawer("recent_activity")}
        />
        <CommandTile
          title={t("spaceDashboard.projectsAtRisk")}
          value={command.projects_at_risk.count}
          hint={labels?.risk ?? t("spaceDashboard.overdueOrStale")}
          icon={<TrendingDown className="w-4 h-4" />}
          tone="warning"
          onClick={() => onOpenDrawer("projects_at_risk")}
        />
        <CommandTile
          title={t("spaceDashboard.quickCreate")}
          value={command.quick_create.items.length}
          hint={
            data.department_preset
              ? t("spaceDashboard.departmentTaskMeetingProject", {
                  department: data.department_preset.name,
                })
              : t("spaceDashboard.taskMeetingProject")
          }
          icon={<Command className="w-4 h-4" />}
          tone="teal"
          onClick={() => onOpenDrawer("quick_create")}
        />
      </section>

      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatusCard
          label={t("spaceDashboard.upcomingActions")}
          value={stats.todo}
          hint={t("spaceDashboard.waitingToStart")}
          icon={<FolderKanban className="w-5 h-5" />}
          tone="warning"
          onClick={() => onOpenDrawer("status:todo")}
        />
        <StatusCard
          label={t("spaceDashboard.inProgressActions")}
          value={stats.inProgress}
          hint={t("spaceDashboard.currentlyBeingWorked")}
          icon={<AlertCircle className="w-5 h-5" />}
          tone="primary"
          onClick={() => onOpenDrawer("status:in_progress")}
        />
        <StatusCard
          label={t("spaceDashboard.completedActions")}
          value={stats.done}
          hint={t("spaceDashboard.percentOfTotal", { percent: stats.progress })}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="success"
          onClick={() => onOpenDrawer("status:done")}
        />
      </section>

      <section className="glass rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("spaceDashboard.spaceProgress")}</p>
            <h3 className="mt-1 text-2xl font-bold text-foreground">{stats.progress}%</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("spaceDashboard.tasksComplete", {
                done: stats.done,
                total: stats.total,
              })}
            </p>
          </div>
          <button
            onClick={onCreateTask}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            {t("spaceDashboard.newTask")}
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
            title={t("spaceDashboard.urgentActions")}
            actionLabel={t("spaceDashboard.viewAll")}
            onAction={() => onOpenDrawer("urgent_actions")}
          />
          <RecordList
            emptyTitle={t("spaceDashboard.noUrgentActions")}
            emptyText={
              labels?.empty ?? t("spaceDashboard.noUrgentActionsHint")
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
            title={t("spaceDashboard.quickCreate")}
            actionLabel={t("spaceDashboard.open")}
            onAction={() => onOpenDrawer("quick_create")}
          />
          <div className="p-4 grid gap-2">
            <QuickCreateButton icon={<CheckSquare className="w-4 h-4" />} onClick={onCreateTask}>
              {t("spaceDashboard.newTask")}
            </QuickCreateButton>
            <QuickCreateButton icon={<CalendarIcon className="w-4 h-4" />} onClick={onCreateMeeting}>
              {t("spaceDashboard.newMeeting")}
            </QuickCreateButton>
            <QuickCreateButton icon={<FolderPlus className="w-4 h-4" />} onClick={onCreateProject}>
              {t("spaceDashboard.newProject")}
            </QuickCreateButton>
          </div>
        </div>
      </section>
    </div>
  );
}

async function readSpaceApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}
