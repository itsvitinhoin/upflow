"use client";

import { useState, useEffect } from "react";
import { useAppUser } from "@/components/user-provider";
import { Plus, AlertCircle } from "lucide-react";
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

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Good day, {user?.name?.split(" ")[0] || "there"} 👋
            </h2>
            <p className="text-muted-foreground mt-1">Here&apos;s what you&apos;re working on</p>
          </div>
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>

        <OnboardingChecklist tasks={tasks} />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-6 bg-muted rounded animate-pulse w-24" />
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-20 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map(({ key, label, color }) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("w-2 h-2 rounded-full", color)} />
                  <h3 className="font-semibold text-sm text-foreground">{label}</h3>
                  <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded-full">
                    {grouped[key].length}
                  </span>
                </div>
                <div className="space-y-2">
                  {grouped[key].length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                      No tasks here
                    </div>
                  ) : (
                    grouped[key].map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "bg-card border border-border rounded-lg p-3 hover:shadow-sm transition-shadow",
                          isOverdue(task.due_date) &&
                            task.status !== "done" &&
                            "border-red-300 dark:border-red-800"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {isOverdue(task.due_date) && task.status !== "done" && (
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <p className="text-sm font-medium text-foreground line-clamp-2 flex-1">
                            {task.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium",
                              priorityColor(task.priority)
                            )}
                          >
                            {task.priority}
                          </span>
                          {task.due_date && (
                            <span
                              className={cn(
                                "text-xs text-muted-foreground",
                                isOverdue(task.due_date) &&
                                  task.status !== "done" &&
                                  "text-red-500 font-medium"
                              )}
                            >
                              {formatDate(task.due_date)}
                            </span>
                          )}
                          {task.project && (
                            <span className="text-xs text-muted-foreground ml-auto truncate">
                              {task.project.name}
                            </span>
                          )}
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
    <div className="bg-card border border-border rounded-xl p-5 mb-6 relative">
      <button
        onClick={() => {
          localStorage.setItem("upflow_onboarding_dismissed", "true");
          setDismissed(true);
        }}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground text-xs"
      >
        Dismiss
      </button>
      <h3 className="font-semibold text-foreground mb-3">Get started with Up Flow</h3>
      <div className="space-y-2">
        {checks.map(({ label, done }) => (
          <div key={label} className="flex items-center gap-3">
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                done ? "bg-primary border-primary" : "border-border"
              )}
            >
              {done && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={cn("text-sm", done ? "line-through text-muted-foreground" : "text-foreground")}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
