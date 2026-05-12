"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Plus, FileText } from "lucide-react";
import Link from "next/link";
import Header from "@/components/layout/header";
import KanbanBoard from "@/components/projects/kanban-board";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import TaskDetailSheet from "@/components/projects/task-detail-sheet";
import { cn, formatDate, statusColor, statusLabel } from "@/lib/utils";
import type { Project, Task } from "@/lib/types";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? "") as string;
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<"board" | "list">("board");

  const loadData = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/tasks?project_id=${id}`),
      ]);
      if (!pRes.ok) {
        router.push("/projects");
        return;
      }
      const [p, t] = await Promise.all([pRes.json() as Promise<Project>, tRes.json() as Promise<Task[]>]);
      setProject(p);
      setTasks(t);
    } catch {
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

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

  return (
    <>
      <Header title={project.name} />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
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
                    statusColor(project.status)
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
                onClick={() => setShowNewTask(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Task
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-border mb-6">
          {(["board", "list"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "board" ? "Kanban Board" : "List View"}
            </button>
          ))}
        </div>

        {activeTab === "board" ? (
          <KanbanBoard projectId={id} tasks={tasks} onUpdate={loadData} />
        ) : (
          <ListView tasks={tasks} onTaskClick={setSelectedTask} />
        )}
      </div>

      {showNewTask && (
        <NewTaskDialog
          open={showNewTask}
          onClose={() => setShowNewTask(false)}
          projectId={id}
          onCreated={() => {
            setShowNewTask(false);
            loadData();
            toast.success("Task created!");
          }}
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

function ListView({
  tasks,
  onTaskClick,
}: {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}) {
  const columns = ["todo", "in_progress", "done"] as const;
  const labels: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  };

  return (
    <div className="space-y-6">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col);
        return (
          <div key={col}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {labels[col]} ({colTasks.length})
            </h3>
            {colTasks.length === 0 ? (
              <div className="text-sm text-muted-foreground py-3 px-4 bg-muted/50 rounded-lg">
                No tasks
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => onTaskClick(task)}
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        task.priority === "high"
                          ? "bg-upflow-danger"
                          : task.priority === "medium"
                          ? "bg-upflow-warning"
                          : "bg-muted-foreground/50"
                      )}
                    />
                    <span className="flex-1 text-sm text-foreground">{task.title}</span>
                    {task.assignee && (
                      <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
