"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, FileText } from "lucide-react";
import Link from "next/link";
import Header from "@/components/layout/header";
import ClientOnboardingPanel from "@/components/onboarding/client-onboarding-panel";
import { useLanguage } from "@/components/language-provider";
import KanbanBoard, { type ColumnKey } from "@/components/projects/kanban-board";
import ListView from "@/components/projects/list-view";
import CreateTaskPanel from "@/components/projects/create-task-panel";
import CustomFieldsManager from "@/components/projects/custom-fields-manager";
import ProjectToolbar, { type ToolbarState } from "@/components/projects/project-toolbar";
import TaskDetailSheet from "@/components/projects/task-detail-sheet";
import { cn, formatDate, statusColor, statusLabel } from "@/lib/utils";
import type {
  AppUser,
  CustomFieldDefinition,
  Project,
  Task,
  TaskAssignee,
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

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const id = (params?.id ?? "") as string;
  const focusedTaskId = searchParams?.get("task") ?? "";
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<TaskAssignee[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [me, setMe] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState<ColumnKey | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [toolbar, setToolbar] = useState<ToolbarState>(DEFAULT_TOOLBAR);

  const loadData = async () => {
    try {
      const [pRes, tRes, fRes, meRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/tasks?project_id=${id}`),
        fetch(`/api/projects/${id}/custom-fields`),
        fetch(`/api/auth/me`),
      ]);
      if (!pRes.ok) {
        router.push("/projects");
        return;
      }
      const [p, t, f, m] = await Promise.all([
        pRes.json() as Promise<Project>,
        tRes.json() as Promise<{ items: Task[] }>,
        fRes.ok ? (fRes.json() as Promise<CustomFieldDefinition[]>) : Promise.resolve([] as CustomFieldDefinition[]),
        meRes.ok ? (meRes.json() as Promise<AppUser>) : Promise.resolve(null as AppUser | null),
      ]);
      const usersRes = await fetch(`/api/users?workspace_id=${p.workspace_id}&status=active`);
      const u = usersRes.ok
        ? ((await usersRes.json()) as { items: TaskAssignee[] })
        : { items: [] as TaskAssignee[] };
      setProject(p);
      setTasks(t.items ?? []);
      setUsers(u.items ?? []);
      setCustomFields(f);
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
    if (task) setSelectedTask(task);
  }, [focusedTaskId, loading, tasks]);

  const canManageFields = useMemo(() => {
    if (!me) return false;
    return Boolean(me.isSuperAdmin || me.currentRole === "owner" || me.currentRole === "admin");
  }, [me]);

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
    setCreateOpen(s);
  };

  return (
    <>
      <Header title={project.name} />
      <div className="mx-auto max-w-[1500px] overflow-x-hidden p-4 sm:p-6">
        <div className="mb-5 rounded-2xl border border-blue-300/10 bg-[#050a18]/35 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.18)] sm:p-6">
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
                className="flex items-center gap-2 rounded-xl border border-blue-300/10 bg-[#071024]/80 px-3 py-2 text-sm font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:border-sky-400/40 hover:bg-sky-400/10"
              >
                <FileText className="w-4 h-4" /> {t("projects.docs")}
              </Link>
              <button
                onClick={() => setCreateOpen("todo")}
                className="upflow-gradient-button flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" /> {t("projects.addTask")}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <ClientOnboardingPanel projectId={id} companyId={project.company_id} onChanged={loadData} />
        </div>

        <ProjectToolbar
          state={toolbar}
          onChange={setToolbar}
          customFields={customFields}
          onManageFields={() => setManageOpen(true)}
          canManage={canManageFields}
          users={users}
        />

        {toolbar.view === "board" ? (
          <KanbanBoard
            projectId={id}
            tasks={tasks}
            customFields={customFields}
            users={users}
            toolbar={toolbar}
            onUpdate={loadData}
            onAddTask={(status) => setCreateOpen(status)}
          />
        ) : (
          <ListView
            projectId={id}
            tasks={tasks}
            customFields={customFields}
            users={users}
            toolbar={toolbar}
            onTaskClick={setSelectedTask}
            onAddTask={handleAddTask}
            onUpdate={loadData}
          />
        )}
      </div>

      {createOpen && (
        <CreateTaskPanel
          open={!!createOpen}
          onClose={() => setCreateOpen(null)}
          projectId={id}
          defaultStatus={createOpen}
          customFields={customFields}
          users={users}
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

      {selectedTask && (
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
      )}
    </>
  );
}
