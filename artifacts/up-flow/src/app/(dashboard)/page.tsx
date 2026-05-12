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
  Square,
  Calendar as CalendarIcon,
  MoreHorizontal,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import { cn, formatDate, getInitials, isOverdue, priorityColor } from "@/lib/utils";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import type { Task, Project, TeamMember } from "@/lib/types";
import {
  todayMeetings,
  activityBubbles,
  recentActions,
  buildTimelineRows,
} from "@/lib/dashboard-mocks";

export default function DashboardPage() {
  const user = useAppUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);

  const loadData = () => {
    Promise.all([
      fetch("/api/tasks?mine=true").then((r) => r.json() as Promise<Task[]>),
      fetch("/api/projects").then((r) => r.json() as Promise<Project[]>),
      fetch("/api/users").then((r) => r.json() as Promise<TeamMember[]>),
    ])
      .then(([t, p, u]) => {
        setTasks(t);
        setProjects(p);
        setUsers(u);
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

          {/* Stat cards (Upcoming / In Progress / Completed Actions) */}
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              tone="stat-1"
              label="Upcoming Actions"
              value={todoCount}
              accent="text-primary"
              icon={<FolderKanban className="w-5 h-5" />}
              hint="Tasks waiting to start"
            />
            <StatCard
              tone="stat-2"
              label="In progress Actions"
              value={inProgressCount}
              accent="text-upflow-warning"
              icon={<AlertCircle className="w-5 h-5" />}
              hint="Currently being worked on"
            />
            <StatCard
              tone="stat-3"
              label="Completed Actions"
              value={doneCount}
              accent="text-upflow-success"
              icon={<CheckCircle2 className="w-5 h-5" />}
              hint={`${progress}% of total`}
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

          {/* Team timeline */}
          <TeamTimeline users={users} loading={loading} />

          {/* Upcoming tasks */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Upcoming tasks</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Sorted by due date</p>
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

function TeamTimeline({
  users,
  loading,
}: {
  users: TeamMember[];
  loading: boolean;
}) {
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i); // 8am - 7pm
  const currentHour = new Date().getHours();
  const totalHours = 11;

  const rows = useMemo(() => buildTimelineRows(users), [users]);

  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Team timeline</h3>
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
      <div className="flex items-center gap-1 overflow-x-auto pb-3 pl-[140px]">
        {hours.map((h) => {
          const isCurrent = h === currentHour;
          return (
            <div
              key={h}
              className={cn(
                "flex-1 min-w-[44px] text-center px-2 py-1.5 text-xs rounded-lg font-medium transition-colors",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground bg-secondary/40"
              )}
            >
              {h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}
            </div>
          );
        })}
      </div>

      {/* Per-teammate rows */}
      <div className="space-y-2 mt-2">
        {loading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No teammates to show
          </div>
        ) : (
          rows.map(({ user: u, blocks, color }) => (
            <div key={u.id} className="flex items-center gap-3">
              <div className="w-[128px] flex items-center gap-2 flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(u.name)}
                </div>
                <span className="text-xs text-foreground truncate">{u.name}</span>
              </div>
              <div className="relative flex-1 h-9 rounded-lg bg-secondary/40 overflow-hidden">
                <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-12">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className={cn(
                        "border-r border-border/40 last:border-r-0",
                        h === currentHour && "bg-primary/10"
                      )}
                    />
                  ))}
                </div>
                {blocks.map((b, i) => {
                  const left = ((b.start - 8) / totalHours) * 100;
                  const width = Math.max(((b.end - b.start) / totalHours) * 100, 4);
                  return (
                    <div
                      key={i}
                      title={`${b.label} · ${b.start > 12 ? `${b.start - 12}pm` : `${b.start}am`} - ${b.end > 12 ? `${b.end - 12}pm` : `${b.end}am`}`}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-md border-l-2 px-2 flex items-center text-[10px] font-medium text-foreground/80 truncate",
                        color
                      )}
                      style={{
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                    >
                      {b.label}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type TimerState = "stopped" | "running" | "paused";

function RightPanel({
  projects,
  userName,
}: {
  projects: Project[];
  userName: string;
}) {
  const [timerState, setTimerState] = useState<TimerState>("stopped");
  const [seconds, setSeconds] = useState(2 * 3600 + 18 * 60); // 2h 18m start

  useEffect(() => {
    if (timerState !== "running") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerState]);

  const fmt = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const am = todayMeetings.filter((m) => parseInt(m.time) < 12);
  const pm = todayMeetings.filter((m) => parseInt(m.time) >= 12);

  const [meetingsOpen, setMeetingsOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(todayMeetings.map((m) => [m.title, true]))
  );

  const bubbles = activityBubbles;
  const recent = recentActions(userName);

  const handleStart = () => setTimerState("running");
  const handlePause = () => setTimerState("paused");
  const handleStop = () => {
    setTimerState("stopped");
    setSeconds(0);
  };

  return (
    <aside className="hidden lg:flex w-[280px] flex-shrink-0 flex-col gap-4 p-6 border-l border-border bg-sidebar/30">
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
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={handleStart}
            disabled={timerState === "running"}
            aria-label="Start timer"
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </button>
          <button
            onClick={handlePause}
            disabled={timerState !== "running"}
            aria-label="Pause timer"
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-upflow-warning/15 text-upflow-warning hover:bg-upflow-warning/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
          <button
            onClick={handleStop}
            disabled={timerState === "stopped"}
            aria-label="Stop timer"
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-upflow-danger/15 text-upflow-danger hover:bg-upflow-danger/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        </div>
      </div>

      {/* Today's meetings — AM/PM grouped with toggles */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Today&apos;s meetings
          </p>
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
        </div>

        {[
          { label: "Morning", items: am },
          { label: "Afternoon", items: pm },
        ].map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  {group.label}
                </p>
                <div className="space-y-2">
                  {group.items.map((mt) => {
                    const open = meetingsOpen[mt.title];
                    return (
                      <button
                        key={mt.title}
                        onClick={() =>
                          setMeetingsOpen((s) => ({ ...s, [mt.title]: !s[mt.title] }))
                        }
                        aria-pressed={open}
                        aria-label={`Toggle ${mt.title}`}
                        className={cn(
                          "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-opacity",
                          open ? "opacity-100" : "opacity-50"
                        )}
                      >
                        <div
                          className={cn(
                            "flex flex-col items-center justify-center w-12 h-12 rounded-xl flex-shrink-0",
                            mt.color
                          )}
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold mt-0.5">{mt.time}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {mt.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {mt.with}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            open ? "bg-upflow-success" : "bg-muted-foreground/40"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )
        )}
      </div>

      {/* Activity bubble chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Activity
          </p>
          <span className="text-xs text-muted-foreground">12 weeks</span>
        </div>
        <div className="relative h-24">
          {bubbles.map((b, i) => {
            const col = i % 12;
            const row = Math.floor(i / 12);
            const left = (col / 11) * 100;
            const top = row === 0 ? 20 + ((i * 17) % 30) : 50 + ((i * 11) % 30);
            return (
              <div
                key={i}
                className="absolute rounded-full bg-primary"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${b.size}px`,
                  height: `${b.size}px`,
                  opacity: b.opacity,
                  transform: "translate(-50%, -50%)",
                }}
              />
            );
          })}
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
