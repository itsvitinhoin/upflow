"use client";

import { useState, useEffect, useMemo } from "react";
import { useAppUser } from "@/components/user-provider";
import {
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  Plus,
  Play,
  Pause,
  Calendar as CalendarIcon,
  MoreHorizontal,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import { cn, formatDate, getInitials, isOverdue, priorityColor } from "@/lib/utils";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import type { Task, Project } from "@/lib/types";

export default function DashboardPage() {
  const user = useAppUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);

  const loadData = () => {
    Promise.all([
      fetch("/api/tasks?mine=true").then((r) => r.json() as Promise<Task[]>),
      fetch("/api/projects").then((r) => r.json() as Promise<Project[]>),
    ])
      .then(([t, p]) => {
        setTasks(t);
        setProjects(p);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const todoCount = tasks.filter((t) => t.status === "todo").length;
  const overdueCount = tasks.filter(
    (t) => isOverdue(t.due_date) && t.status !== "done"
  ).length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const upcomingTasks = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.status !== "done")
        .sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        })
        .slice(0, 6),
    [tasks]
  );

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <>
      <Header title="Dashboard" />
      <div className="flex">
        {/* Main content */}
        <div className="flex-1 min-w-0 p-6 space-y-6">
          {/* Greeting */}
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Good {greetingTime()}, {firstName} 👋
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Here&apos;s what&apos;s happening across your workspace today.
            </p>
          </div>

          {/* Stat cards */}
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              tone="stat-1"
              label="My open tasks"
              value={todoCount + inProgressCount}
              accent="text-primary"
              icon={<FolderKanban className="w-5 h-5" />}
              hint={`${inProgressCount} in progress`}
            />
            <StatCard
              tone="stat-2"
              label="Completed"
              value={doneCount}
              accent="text-upflow-success"
              icon={<CheckCircle2 className="w-5 h-5" />}
              hint={`${progress}% of total`}
            />
            <StatCard
              tone="stat-3"
              label="Needs attention"
              value={overdueCount}
              accent="text-upflow-danger"
              icon={<AlertCircle className="w-5 h-5" />}
              hint={overdueCount === 0 ? "Nothing overdue" : "Past due date"}
            />
          </section>

          {/* Progress widget */}
          <section className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Weekly progress</p>
                <h3 className="mt-1 text-2xl font-bold text-foreground">{progress}%</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {doneCount} of {tasks.length || 0} tasks complete
                </p>
              </div>
              <button
                onClick={() => setShowNewTask(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
            </div>
            <div className="mt-4 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-upflow-success transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>

          {/* Timeline */}
          <Timeline tasks={tasks} />

          {/* Upcoming tasks */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Upcoming tasks</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sorted by due date
                </p>
              </div>
              <button
                onClick={() => setShowNewTask(true)}
                className="text-xs text-primary hover:underline"
              >
                + Add task
              </button>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                ))
              ) : upcomingTasks.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No tasks yet — create your first one.
                </div>
              ) : (
                upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/50 transition-colors"
                  >
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {task.title}
                      </p>
                      {task.project?.name && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {task.project.name}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        priorityColor(task.priority)
                      )}
                    >
                      {task.priority}
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
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right panel */}
        <RightPanel projects={projects} userName={user?.name || "there"} />
      </div>

      {showNewTask && (
        <NewTaskDialog
          open={showNewTask}
          onClose={() => setShowNewTask(false)}
          onCreated={() => {
            setShowNewTask(false);
            loadData();
            toast.success("Task created");
          }}
        />
      )}
    </>
  );
}

function greetingTime() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function StatCard({
  tone,
  label,
  value,
  accent,
  icon,
  hint,
}: {
  tone: "stat-1" | "stat-2" | "stat-3";
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
  hint: string;
}) {
  const bg =
    tone === "stat-1"
      ? "bg-upflow-stat-1"
      : tone === "stat-2"
      ? "bg-upflow-stat-2"
      : "bg-upflow-stat-3";
  return (
    <div className={cn("rounded-2xl border border-border p-5", bg)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-xl bg-background/50",
            accent
          )}
        >
          {icon}
        </div>
      </div>
      <h3 className="mt-3 text-3xl font-bold text-foreground">{value}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Timeline({ tasks }: { tasks: Task[] }) {
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i); // 8am - 7pm
  const currentHour = new Date().getHours();

  // Build deterministic timeline blocks from tasks (using hash of id) so the UI feels populated.
  const blocks = useMemo(() => {
    const items = tasks.slice(0, 8);
    return items
      .map((t, idx) => {
        const seed = (t.id.charCodeAt(0) || 0) + idx * 7;
        const start = 8 + (seed % 10); // 8 - 17
        const duration = 1 + (seed % 3); // 1 - 3 hours
        return { task: t, start, end: Math.min(start + duration, 19) };
      })
      .filter((b) => b.start < 19);
  }, [tasks]);

  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Today&apos;s timeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          aria-label="Timeline options"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Hour pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 -mx-1 px-1">
        {hours.map((h) => {
          const isCurrent = h === currentHour;
          return (
            <div
              key={h}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground bg-secondary/50"
              )}
            >
              {h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}
            </div>
          );
        })}
      </div>

      {/* Timeline rail */}
      <div className="relative mt-4 h-24 rounded-xl bg-secondary/40 overflow-hidden">
        <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-12">
          {hours.map((h) => (
            <div
              key={h}
              className={cn(
                "border-r border-border/50 last:border-r-0",
                h === currentHour && "bg-primary/5"
              )}
            />
          ))}
        </div>
        {blocks.length === 0 ? (
          <div className="relative z-10 h-full flex items-center justify-center text-xs text-muted-foreground">
            No scheduled work
          </div>
        ) : (
          blocks.map((b, i) => {
            const totalHours = 11; // 8 -> 19
            const left = ((b.start - 8) / totalHours) * 100;
            const width = ((b.end - b.start) / totalHours) * 100;
            const colors = [
              "bg-primary/30 border-primary",
              "bg-upflow-success/25 border-upflow-success",
              "bg-upflow-warning/25 border-upflow-warning",
              "bg-upflow-danger/25 border-upflow-danger",
            ];
            return (
              <div
                key={b.task.id}
                title={b.task.title}
                className={cn(
                  "absolute top-3 bottom-3 rounded-lg border-l-2 px-3 flex flex-col justify-center overflow-hidden",
                  colors[i % colors.length]
                )}
                style={{
                  left: `calc(${left}% + 4px)`,
                  width: `calc(${width}% - 8px)`,
                }}
              >
                <p className="text-[11px] font-semibold text-foreground truncate">
                  {b.task.title}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {b.start > 12 ? `${b.start - 12}pm` : `${b.start}am`} –{" "}
                  {b.end > 12 ? `${b.end - 12}pm` : b.end === 12 ? "12pm" : `${b.end}am`}
                </p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function RightPanel({
  projects,
  userName,
}: {
  projects: Project[];
  userName: string;
}) {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(2 * 3600 + 18 * 60); // start at 2h 18m

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const fmt = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const meetings = [
    { time: "10:00", title: "Team standup", with: "Engineering", color: "bg-primary/20 text-primary" },
    { time: "14:30", title: "Design review", with: "Product · Design", color: "bg-upflow-success/20 text-upflow-success" },
    { time: "16:00", title: "Client check-in", with: "Acme Corp", color: "bg-upflow-warning/20 text-upflow-warning" },
  ];

  const activity = Array.from({ length: 12 }, (_, i) => 0.3 + ((i * 31) % 70) / 100);

  const recent = [
    { who: "Maya", what: "completed", target: "Login screen", when: "12m ago" },
    { who: "Eli", what: "commented on", target: "API rate limits", when: "27m ago" },
    { who: userName, what: "moved", target: "Onboarding flow", when: "1h ago" },
    { who: "Tomás", what: "created", target: "New project: Atlas", when: "2h ago" },
  ];

  return (
    <aside className="hidden xl:flex w-[300px] flex-shrink-0 flex-col gap-4 p-6 border-l border-border bg-sidebar/30">
      {/* Time tracking */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Time tracking
          </p>
          <button
            aria-label="Time tracking options"
            className="text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
        <div className="font-mono text-3xl font-bold text-foreground tabular-nums">
          {fmt(h)}:{fmt(m)}:{fmt(s)}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {projects[0]?.name || "No active project"}
        </p>
        <button
          onClick={() => setRunning((r) => !r)}
          className={cn(
            "mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors",
            running
              ? "bg-upflow-danger/15 text-upflow-danger hover:bg-upflow-danger/25"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {running ? "Pause timer" : "Start timer"}
        </button>
      </div>

      {/* Today's meetings */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Today&apos;s meetings
          </p>
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.title} className="flex items-start gap-3">
              <div
                className={cn(
                  "flex flex-col items-center justify-center w-12 h-12 rounded-xl flex-shrink-0",
                  m.color
                )}
              >
                <Video className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold mt-0.5">{m.time}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {m.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">{m.with}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Activity
          </p>
          <span className="text-xs text-muted-foreground">12 weeks</span>
        </div>
        <div className="flex items-end gap-1.5 h-16">
          {activity.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-primary/30 to-primary"
              style={{ height: `${v * 100}%` }}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="text-upflow-success font-medium">+12%</span> vs last quarter
        </p>
      </div>

      {/* Last actions */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Last actions
        </p>
        <div className="space-y-3">
          {recent.map((r, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {getInitials(r.who)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground leading-snug">
                  <span className="font-medium">{r.who}</span>{" "}
                  <span className="text-muted-foreground">{r.what}</span>{" "}
                  <span className="font-medium">{r.target}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{r.when}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
