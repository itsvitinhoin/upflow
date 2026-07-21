"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, FileText, Trash2, X, CheckSquare2, Loader2 } from "lucide-react";
import Link from "next/link";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";
import KanbanBoard, { type ColumnKey } from "@/components/projects/kanban-board";
import ListView from "@/components/projects/list-view";
import TaskCreateSheet from "@/components/projects/task-create-sheet";
import CustomFieldsManager from "@/components/projects/custom-fields-manager";
import ProjectToolbar, { type ToolbarState } from "@/components/projects/project-toolbar";
import TaskDetailSheet from "@/components/projects/task-detail-sheet";
import CreativeBriefingForm from "@/components/projects/creative-briefing-form";
import SocialMediaCalendar from "@/components/projects/social-media-calendar";
import { SpaceWorkflowStatusManager } from "@/components/spaces/space-workflow-status-manager";
import { cn, formatDate, statusColor, statusLabel } from "@/lib/utils";
import { getOnboardingTaskAction, workflowFormKind } from "@/lib/onboarding-task-routing";
import { isFinanceOnboardingSpace } from "@/lib/onboarding-routing";
import { isSocialMediaCalendarListName } from "@/lib/social-media";
import type {
  AppUser,
  CustomFieldDefinition,
  Project,
  Task,
  TaskAssignee,
  WorkflowStatus,
} from "@/lib/types";

const DEFAULT_TOOLBAR: ToolbarState = {
  view: "board",
  search: "",
  groupBy: "status",
  sortBy: "position",
  sortDir: "asc",
  showClosed: true,
  visibleColumns: {},
  filterPriority: "all",
  filterAssignee: "all",
};

interface CreateTaskDefaults {
  status: ColumnKey;
  fieldValues?: Record<string, unknown>;
}

function OnboardingFormLoader() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-border bg-card p-6" aria-label={t("common.loading")}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    </div>
  );
}

const FinanceOnboardingForm = dynamic(() => import("@/components/onboarding/finance-onboarding-form"), {
  ssr: false,
  loading: OnboardingFormLoader,
});

const MarketingB2BOnboardingForm = dynamic(() => import("@/components/onboarding/marketing-b2b-onboarding-form"), {
  ssr: false,
  loading: OnboardingFormLoader,
});

const MarketingB2COnboardingForm = dynamic(() => import("@/components/onboarding/marketing-b2c-onboarding-form"), {
  ssr: false,
  loading: OnboardingFormLoader,
});

const SupportOnboardingForm = dynamic(() => import("@/components/onboarding/support-onboarding-form"), {
  ssr: false,
  loading: OnboardingFormLoader,
});

function isDesignQueueProject(project: Project | null) {
  if (!project) return false;
  const projectName = project.name.trim().toLocaleLowerCase();
  const spaceName = project.space?.name.trim().toLocaleLowerCase();
  return (
    projectName === "design queue" &&
    (spaceName === "creative & design" || spaceName === "criativos & design")
  );
}

function isSocialMediaProject(project: Project | null) {
  return isSocialMediaCalendarListName(project?.name);
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const id = (params?.id ?? "") as string;
  const focusedTaskId = searchParams?.get("task") ?? "";
  const viewParam = searchParams?.get("view") ?? "";
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<TaskAssignee[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [workflowStatuses, setWorkflowStatuses] = useState<WorkflowStatus[]>([]);
  const [me, setMe] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState<CreateTaskDefaults | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSpaceStatusesOpen, setManageSpaceStatusesOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [deletingSelectedTasks, setDeletingSelectedTasks] = useState(false);
  const [toolbar, setToolbar] = useState<ToolbarState>(DEFAULT_TOOLBAR);

  const loadData = async () => {
    try {
      const [pRes, tRes, fRes, meRes, wRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/tasks?project_id=${id}`),
        fetch(`/api/projects/${id}/custom-fields`),
        fetch(`/api/auth/me`),
        fetch(`/api/workflow-statuses?project_id=${id}&category=task&limit=100`),
      ]);
      if (!pRes.ok) {
        router.push("/projects");
        return;
      }
      const [p, t, f, m, w] = await Promise.all([
        pRes.json() as Promise<Project>,
        tRes.json() as Promise<{ items: Task[] }>,
        fRes.ok ? (fRes.json() as Promise<CustomFieldDefinition[]>) : Promise.resolve([] as CustomFieldDefinition[]),
        meRes.ok ? (meRes.json() as Promise<AppUser>) : Promise.resolve(null as AppUser | null),
        wRes.ok
          ? (wRes.json() as Promise<{ items: WorkflowStatus[] }>)
          : Promise.resolve({ items: [] as WorkflowStatus[] }),
      ]);
      const usersRes = await fetch(`/api/users?workspace_id=${p.workspace_id}&status=active`);
      const u = usersRes.ok
        ? ((await usersRes.json()) as { items: TaskAssignee[] })
        : { items: [] as TaskAssignee[] };
      setProject(p);
      setTasks(t.items ?? []);
      setUsers(u.items ?? []);
      setCustomFields(f);
      setWorkflowStatuses(w.items ?? []);
      setMe(m);
    } catch {
      toast.error(t("projects.failedToLoad"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!focusedTaskId || loading) return;
    const task = tasks.find((item) => item.id === focusedTaskId);
    if (!task) return;
    const action = getOnboardingTaskAction(task, id);
    if (action?.kind === "form") {
      setSelectedTask(null);
      if (viewParam !== "form") {
        router.replace(action.href, { scroll: false });
      }
      return;
    }
    if (action) {
      setSelectedTask(null);
      router.replace(action.href, { scroll: false });
      return;
    }
    setSelectedTask(task);
  }, [focusedTaskId, id, loading, router, tasks, viewParam]);

  useEffect(() => {
    const liveTaskIds = new Set(tasks.map((task) => task.id));
    setSelectedTaskIds((current) => {
      const next = current.filter((taskId) => liveTaskIds.has(taskId));
      return next.length === current.length ? current : next;
    });
  }, [tasks]);

  const workflowFormTask = useMemo(() => {
    const formTaskForProject = (task: Task) => {
      const kind = workflowFormKind(task);
      if (!kind) return false;
      return kind !== "finance" || isFinanceOnboardingSpace(project?.space?.name);
    };
    const focused = focusedTaskId ? tasks.find((task) => task.id === focusedTaskId) : null;
    if (focused && formTaskForProject(focused)) return focused;
    return tasks.find(formTaskForProject) ?? null;
  }, [focusedTaskId, project?.space?.name, tasks]);
  const currentWorkflowKind = workflowFormTask ? workflowFormKind(workflowFormTask) : null;
  const showWorkflowFormFirst = Boolean(workflowFormTask && currentWorkflowKind && viewParam !== "kanban");
  const isDesignQueue = isDesignQueueProject(project);
  const isSocialMedia = isSocialMediaProject(project);
  const selectedTaskIdSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const visibleTaskIds = useMemo(() => {
    const query = toolbar.search.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (
          query &&
          !task.title.toLowerCase().includes(query) &&
          !(task.description ?? "").toLowerCase().includes(query)
        ) {
          return false;
        }
        if (!toolbar.showClosed && task.status === "done") return false;
        if (toolbar.filterPriority !== "all" && task.priority !== toolbar.filterPriority) {
          return false;
        }
        if (toolbar.filterAssignee === "unassigned") return !task.assignee;
        if (toolbar.filterAssignee !== "all") {
          return task.assignee?.id === toolbar.filterAssignee;
        }
        return true;
      })
      .map((task) => task.id);
  }, [tasks, toolbar]);
  const allVisibleTasksSelected =
    visibleTaskIds.length > 0 && visibleTaskIds.every((taskId) => selectedTaskIdSet.has(taskId));

  const canManageFields = useMemo(() => {
    if (!me) return false;
    return Boolean(me.isSuperAdmin || me.currentRole === "owner" || me.currentRole === "admin");
  }, [me]);

  useEffect(() => {
    if (!isDesignQueue) {
      setToolbar((current) =>
        current.view === "form" ? { ...current, view: "board" } : current,
      );
      return;
    }
    const requestedView =
      viewParam === "briefing" ? "form" : viewParam === "list" ? "list" : "board";
    setToolbar((current) =>
      current.view === requestedView ? current : { ...current, view: requestedView },
    );
  }, [isDesignQueue, viewParam]);

  if (loading) {
    return (
      <>
        <Header title={t("projects.project")} />
        <div className="space-y-4 p-4 sm:p-6">
          <div className="h-8 bg-muted rounded w-48 animate-pulse" />
          <div className="h-4 bg-muted rounded w-96 animate-pulse" />
        </div>
      </>
    );
  }

  if (!project) return null;

  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  const handleAddTask = (status?: string) => {
    const s = (status === "in_progress" || status === "done" ? status : "todo") as ColumnKey;
    setCreateOpen({ status: s });
  };

  const handleOpenTask = (task: Task) => {
    const action = getOnboardingTaskAction(task, id);
    if (action) {
      setSelectedTask(null);
      router.replace(action.href, { scroll: false });
      return;
    }
    setSelectedTask(task);
  };

  const handleToolbarChange = (next: ToolbarState) => {
    setToolbar(next);
    if (!isDesignQueue || next.view === toolbar.view) return;
    const view = next.view === "form" ? "briefing" : next.view;
    router.replace(`/projects/${id}?view=${view}`, { scroll: false });
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );
  };

  const toggleSelectionMode = () => {
    if (selectionMode) setSelectedTaskIds([]);
    setSelectionMode(!selectionMode);
  };

  const toggleVisibleTaskSelection = () => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (allVisibleTasksSelected) {
        visibleTaskIds.forEach((taskId) => next.delete(taskId));
      } else {
        visibleTaskIds.forEach((taskId) => next.add(taskId));
      }
      return Array.from(next);
    });
  };

  const handleDeleteSelectedTasks = async () => {
    if (selectedTaskIds.length === 0 || deletingSelectedTasks) return;
    if (!confirm(t("task.bulkDeleteConfirm", { count: selectedTaskIds.length }))) return;
    const idsToDelete = [...selectedTaskIds];
    setDeletingSelectedTasks(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? t("task.failedDelete"));
      }
      const deletedCount = idsToDelete.length;
      setSelectedTaskIds([]);
      setSelectionMode(false);
      setSelectedTask((current) =>
        current && idsToDelete.includes(current.id) ? null : current,
      );
      await loadData();
      toast.success(t("task.bulkDeleteSuccess", { count: deletedCount }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("task.failedDelete"));
    } finally {
      setDeletingSelectedTasks(false);
    }
  };

  const workflowFormTabLabel =
    currentWorkflowKind === "finance"
      ? "Cadastro financeiro"
      : currentWorkflowKind === "support"
        ? "Setup de suporte"
      : currentWorkflowKind === "marketing_b2c"
        ? t("marketingB2CForm.formTab")
        : t("marketingB2BForm.formTab");

  return (
    <>
      <Header title={project.name} />
      <div className="mx-auto max-w-[1500px] overflow-x-clip p-4 sm:p-6">
        <div className="mb-5 rounded-2xl border border-border bg-card/80 p-4 shadow-sm sm:p-6">
          <Link
            href="/projects"
            className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> {t("projects.backToProjects")}
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-3">
                <h2 className="min-w-0 break-words text-3xl font-bold tracking-tight text-foreground">{project.name}</h2>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold shadow-[0_0_18px_rgba(16,185,129,0.18)]",
                    statusColor(project.status),
                  )}
                >
                  {statusLabel(project.status)}
                </span>
              </div>
              {project.description && (
                <p className="text-muted-foreground text-sm mb-3">{project.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground sm:gap-4">
                <span>{t("projects.tasksLabel", { count: tasks.length })}</span>
                {project.due_date && <span>{t("projects.due", { date: formatDate(project.due_date) })}</span>}
                <span className="flex items-center gap-1.5">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {t("projects.doneProgress", { progress })}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/docs?project=${id}`}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
              >
                <FileText className="w-4 h-4" /> {t("projects.docs")}
              </Link>
              <button
                onClick={() => setCreateOpen({ status: "todo" })}
                className="upflow-gradient-button flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" /> {t("projects.addTask")}
              </button>
            </div>
          </div>
        </div>

        {workflowFormTask && currentWorkflowKind && (
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/70">
            <button
              type="button"
              onClick={() => router.replace(`/projects/${id}?view=form&task=${workflowFormTask.id}`, { scroll: false })}
              aria-pressed={showWorkflowFormFirst}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition",
                showWorkflowFormFirst
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {workflowFormTabLabel}
            </button>
            <button
              type="button"
              onClick={() => router.replace(`/projects/${id}?view=kanban`, { scroll: false })}
              aria-pressed={!showWorkflowFormFirst}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition",
                !showWorkflowFormFirst
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t("marketingB2BForm.kanbanTab")}
            </button>
          </div>
        )}

        {isSocialMedia ? (
          <SocialMediaCalendar
            projectId={id}
            workspaceId={project.workspace_id}
            tasks={tasks}
            customFields={customFields}
            users={users}
            onOpenTask={handleOpenTask}
            onRefresh={loadData}
          />
        ) : showWorkflowFormFirst && workflowFormTask && currentWorkflowKind ? (
          currentWorkflowKind === "finance" ? (
            <FinanceOnboardingForm taskId={workflowFormTask.id} embedded onUpdate={loadData} />
          ) : currentWorkflowKind === "support" ? (
            <SupportOnboardingForm taskId={workflowFormTask.id} embedded onUpdate={loadData} />
          ) : currentWorkflowKind === "marketing_b2c" ? (
            <MarketingB2COnboardingForm taskId={workflowFormTask.id} embedded onUpdate={loadData} />
          ) : (
            <MarketingB2BOnboardingForm
              taskId={workflowFormTask.id}
              embedded
              onClose={() => router.replace(`/projects/${id}?view=kanban`, { scroll: false })}
              onAddTask={() => setCreateOpen({ status: "todo" })}
              onUpdate={loadData}
            />
          )
        ) : (
          <>
            <ProjectToolbar
              state={toolbar}
              onChange={handleToolbarChange}
              customFields={customFields}
              onManageFields={() => setManageOpen(true)}
              onManageSpaceStatuses={
                canManageFields && project.space_id
                  ? () => setManageSpaceStatusesOpen(true)
                  : undefined
              }
              canManage={canManageFields}
              users={users}
              selectionMode={selectionMode}
              selectedCount={selectedTaskIds.length}
              onToggleSelectionMode={toggleSelectionMode}
              enableForms={isDesignQueue}
            />

            {toolbar.view !== "form" && selectionMode && (
              <div className="mb-3 flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {t("task.bulkSelected", { count: selectedTaskIds.length })}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleVisibleTaskSelection}
                    disabled={visibleTaskIds.length === 0 || deletingSelectedTasks}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <CheckSquare2 className="h-4 w-4" />
                    {allVisibleTasksSelected
                      ? t("task.deselectAllVisible")
                      : t("task.selectAllVisible", { count: visibleTaskIds.length })}
                  </button>
                  <button
                    type="button"
                    onClick={toggleSelectionMode}
                    disabled={deletingSelectedTasks}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <X className="h-4 w-4" />
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedTasks}
                    disabled={selectedTaskIds.length === 0 || deletingSelectedTasks}
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/[0.15] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {deletingSelectedTasks ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {t("task.deleteSelected")}
                  </button>
                </div>
              </div>
            )}

            {toolbar.view === "form" && isDesignQueue ? (
              <CreativeBriefingForm
                projectId={id}
                workspaceId={project.workspace_id}
                users={users}
                me={me}
                onCreated={loadData}
                onDesignerRosterConfigured={loadData}
              />
            ) : toolbar.view === "board" ? (
              <KanbanBoard
                projectId={id}
                spaceId={project?.space_id}
                tasks={tasks}
                customFields={customFields}
                workflowStatuses={workflowStatuses}
                users={users}
                toolbar={toolbar}
                onUpdate={loadData}
                onAddTask={(status, fieldValues) => setCreateOpen({ status, fieldValues })}
                onOpenTask={handleOpenTask}
                selectedTaskIds={selectedTaskIdSet}
                onToggleTaskSelection={toggleTaskSelection}
                selectionMode={selectionMode}
                showBriefingDetails={isDesignQueue}
              />
            ) : (
              <ListView
                projectId={id}
                tasks={tasks}
                customFields={customFields}
                users={users}
                toolbar={toolbar}
                onTaskClick={handleOpenTask}
                onAddTask={handleAddTask}
                onUpdate={loadData}
                selectedTaskIds={selectedTaskIdSet}
                onToggleTaskSelection={toggleTaskSelection}
                selectionMode={selectionMode}
              />
            )}
          </>
        )}
      </div>

      {createOpen && (
        <TaskCreateSheet
          open={!!createOpen}
          onClose={() => setCreateOpen(null)}
          projectId={id}
          defaultStatus={createOpen.status}
          initialCustomFieldValues={createOpen.fieldValues}
          onCreated={() => {
            setCreateOpen(null);
            loadData();
          }}
        />
      )}

      {manageOpen && (
        <CustomFieldsManager
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          projectId={id}
          fields={customFields}
          onChanged={loadData}
        />
      )}

      {project.space_id && canManageFields && (
        <SpaceWorkflowStatusManager
          open={manageSpaceStatusesOpen}
          spaceId={project.space_id}
          onClose={() => setManageSpaceStatusesOpen(false)}
          onSaved={loadData}
        />
      )}

      {selectedTask && workflowFormKind(selectedTask) ? (
        workflowFormKind(selectedTask) === "finance" ? (
          <FinanceOnboardingForm
            taskId={selectedTask.id}
            onClose={() => {
              setSelectedTask(null);
              if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
            }}
            onUpdate={() => {
              setSelectedTask(null);
              if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
              loadData();
            }}
          />
        ) : workflowFormKind(selectedTask) === "support" ? (
          <SupportOnboardingForm
            taskId={selectedTask.id}
            onClose={() => {
              setSelectedTask(null);
              if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
            }}
            onUpdate={() => {
              setSelectedTask(null);
              if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
              loadData();
            }}
          />
        ) : workflowFormKind(selectedTask) === "marketing_b2c" ? (
          <MarketingB2COnboardingForm
            taskId={selectedTask.id}
            onClose={() => {
              setSelectedTask(null);
              if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
            }}
            onUpdate={() => {
              setSelectedTask(null);
              if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
              loadData();
            }}
          />
        ) : (
          <MarketingB2BOnboardingForm
            taskId={selectedTask.id}
            onClose={() => {
              setSelectedTask(null);
              if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
            }}
            onAddTask={() => {
              setSelectedTask(null);
              setCreateOpen({ status: "todo" });
            }}
            onUpdate={() => {
              setSelectedTask(null);
              if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
              loadData();
            }}
          />
        )
      ) : selectedTask ? (
        <TaskDetailSheet
          task={selectedTask}
          users={users}
          onClose={() => {
            setSelectedTask(null);
            if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
          }}
          onUpdate={() => {
            setSelectedTask(null);
            if (focusedTaskId) router.replace(`/projects/${id}`, { scroll: false });
            loadData();
          }}
        />
      ) : null}
    </>
  );
}
