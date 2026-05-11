"use client";

import { useState, useEffect } from "react";
import { useAppUser } from "@/components/user-provider";
import { Plus, AlertCircle, CheckCircle2, FolderKanban, Users, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import { cn, formatDate, isOverdue, priorityColor } from "@/lib/utils";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import type { Task, Project } from "@/lib/types";

const COLUMNS = [
  { key: "todo", label: "To Do", color: "bg-gray-400" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { key: "done", label: "Done", color: "bg-green-500" },
] as const;

export default function DashboardPage() {
  const user = useAppUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);

  const loadTasks = () =>
    fetch("/api/tasks?mine=true")
      .then((r) => r.json())
      .then((data: Task[]) => {
        setTasks(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => {
    loadTasks();
  }, []);

  const grouped: Record<string, Task[]> = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    done: tasks.filter((t) => t.status === "done"),
  };

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const dueSoon = tasks.filter((t) => t.due_date && !isOverdue(t.due_date) && t.status !== "done").length;

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Welcome back</p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">
                  {user?.name?.split(" ")[0] || "there"}, you&apos;re doing great
                </h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LayoutDashboard className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Track tasks, move work forward, and keep the team aligned.</p>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <h3 className="mt-1 text-2xl font-bold text-foreground">{progress}%</h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{doneCount} completed of {tasks.length || 0} tasks</p>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due soon</p>
                <h3 className="mt-1 text-2xl font-bold text-foreground">{dueSoon}</h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Tasks that need attention before they slip.</p>
          </div>
        </section>

        <div className="flex items-center justify-between rounded-2xl border bg-card px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-medium text-foreground">Quick actions</p>
            <p className="text-sm text-muted-foreground">Create work items and keep the board moving.</p>
          </div>
          <button
            onClick={() => setShowNewTask(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>

        <OnboardingChecklist tasks={tasks} />

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
                <div className="h-5 w-28 rounded bg-muted animate-pulse" />
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-20 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {COLUMNS.map(({ key, label, color }) => (
              <div key={key} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
                  <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                  <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {grouped[key].length}
                  </span>
                </div>
                <div className="space-y-2">
                  {grouped[key].length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                      No tasks here
                    </div>
                  ) : (
                    grouped[key].map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "rounded-xl border bg-muted/30 p-4 transition-all hover:-translate-y-0.5 hover:bg-muted/60 hover:shadow-sm",
                          isOverdue(task.due_date) && task.status !== "done" && "border-red-300 dark:border-red-800"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {isOverdue(task.due_date) && task.status !== "done" && (
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                          )}
                          <p className="flex-1 text-sm font-medium leading-snug text-foreground line-clamp-2">{task.title}</p>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs">
                          <span className={cn("rounded-full px-2 py-0.5 font-medium", priorityColor(task.priority))}>
                            {task.priority}
                          </span>
                          {task.due_date && (
                            <span className={cn("text-muted-foreground", isOverdue(task.due_date) && task.status !== "done" && "font-medium text-red-500")}>
                              {formatDate(task.due_date)}
                            </span>
                          )}
                          {task.project && <span className="ml-auto truncate text-muted-foreground">{task.project.name}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewTask && (
        <NewTaskDialog
          open={showNewTask}
          onClose={() => setShowNewTask(false)}
          onCreated={() => {
            setShowNewTask(false);
            loadTasks();
            toast.success("Task created");
          }}
        />
      )}
    </>
  );
}

function OnboardingChecklist({ tasks }: { tasks: Task[] }) {
  const [dismissed, setDismissed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamSize, setTeamSize] = useState(0);

  useEffect(() => {
    const d = localStorage.getItem("upflow_onboarding_dismissed");
    if (d === "true") setDismissed(true);
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ])
      .then(([p, u]: [Project[], { id: string }[]]) => {
        setProjects(p);
        setTeamSize(u.length);
      })
      .catch(() => {});
  }, []);

  const checks = [
    { label: "Create your first project", done: projects.length > 0 },
    { label: "Add a task", done: tasks.length > 0 },
    { label: "Invite a teammate", done: teamSize > 1 },
  ];

  const allDone = checks.every((c) => c.done);

  if (dismissed || allDone) return null;

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Get started with Up Flow</p>
          <p className="mt-1 text-sm text-muted-foreground">Finish these steps to set up your workspace.</p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem("upflow_onboarding_dismissed", "true");
            setDismissed(true);
          }}
          className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
      <div className="space-y-3">
        {checks.map(({ label, done }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border-2 flex-shrink-0",
                done ? "border-primary bg-primary" : "border-border"
              )}
            >
              {done && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={cn("text-sm", done ? "text-muted-foreground line-through" : "text-foreground")}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
