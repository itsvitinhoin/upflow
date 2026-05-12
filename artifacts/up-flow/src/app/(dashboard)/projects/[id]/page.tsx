"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, FileText } from "lucide-react";
import Link from "next/link";
import Header from "@/components/layout/header";
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
  view: "list",
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
  const id = (params?.id ?? "") as string;
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
      const [pRes, tRes, uRes, fRes, meRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/tasks?project_id=${id}`),
        fetch(`/api/users`),
        fetch(`/api/projects/${id}/custom-fields`),
        fetch(`/api/auth/me`),
      ]);
      if (!pRes.ok) {
        router.push("/projects");
        return;
      }
      const [p, t, u, f, m] = await Promise.all([
        pRes.json() as Promise<Project>,
        tRes.json() as Promise<Task[]>,
        uRes.ok ? (uRes.json() as Promise<TaskAssignee[]>) : Promise.resolve([]),
        fRes.ok ? (fRes.json() as Promise<CustomFieldDefinition[]>) : Promise.resolve([]),
        meRes.ok ? (meRes.json() as Promise<AppUser>) : Promise.resolve(null as AppUser | null),
      ]);
      setProject(p);
      setTasks(t);
      setUsers(u);
      setCustomFields(f);
      setMe(m);
    } catch {
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canManageFields = useMemo(() => {
    if (!me || !project) return false;
    return me.role === "admin" || me.id === project.owner_id;
  }, [me, project]);

  if (loading) {
    return (
      <>
        <Header title="Project" />
        <div className="p-6 space-y-4">
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
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="mb-4">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Projects
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1.5">
                <h2 className="text-2xl font-bold text-foreground">{project.name}</h2>
                <span
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full font-medium",
                    statusColor(project.status),
                  )}
                >
                  {statusLabel(project.status)}
                </span>
              </div>
              {project.description && (
                <p className="text-muted-foreground text-sm mb-3">{project.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{tasks.length} tasks</span>
                {project.due_date && <span>Due {formatDate(project.due_date)}</span>}
                <span className="flex items-center gap-1.5">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {progress}% done
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/docs?project=${id}`}
                className="flex items-center gap-2 border border-border bg-card hover:bg-muted text-foreground text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" /> Docs
              </Link>
              <button
                onClick={() => setCreateOpen("todo")}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Task
              </button>
            </div>
          </div>
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
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            setSelectedTask(null);
            loadData();
          }}
        />
      )}
    </>
  );
}
