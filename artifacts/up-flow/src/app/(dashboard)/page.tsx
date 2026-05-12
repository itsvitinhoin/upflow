"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
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
  RotateCcw,
  Repeat,
  X,
  FolderPlus,
  CheckSquare,
  UserPlus,
  Building2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/header";
import { cn, formatDate, getInitials, isOverdue, priorityColor } from "@/lib/utils";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import InviteDialog from "@/components/dashboard/invite-dialog";
import ScheduleMeetingDialog, {
  loadStoredMeetings,
} from "@/components/dashboard/schedule-meeting-dialog";
import CreateCompanyDialog from "@/components/dashboard/create-company-dialog";
import type { Task, Project, TeamMember } from "@/lib/types";
import {
  todayMeetings,
  weekActivity,
  recentActions,
  buildTimelineRows,
  type Meeting,
} from "@/lib/dashboard-mocks";

type StatusFilter = "all" | "todo" | "in_progress" | "done";
type ActionFilter = "all" | "completed" | "in_progress";

export default function DashboardPage() {
  const user = useAppUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [extraMeetings, setExtraMeetings] = useState<Meeting[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setExtraMeetings(loadStoredMeetings());
  }, []);

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

  const filteredTasks = useMemo(
    () =>
      [...tasks]
        .filter((t) => (statusFilter === "all" ? t.status !== "done" : t.status === statusFilter))
        .sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        })
        .slice(0, 6),
    [tasks, statusFilter]
  );

  const firstName = user?.name?.split(" ")[0] || "there";

  const handleStatusChange = async (task: Task, status: Task["status"]) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(`Task moved to ${status.replace("_", " ")}`);
      setActiveTask(null);
      loadData();
    } catch {
      toast.error("Could not update task");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Task deleted");
      setActiveTask(null);
      loadData();
    } catch {
      toast.error("Could not delete task");
    } finally {
      setUpdating(false);
    }
  };

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

          {/* Quick actions */}
          <section className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <QuickAction
              label="Create Project"
              hint="Start something new"
              icon={<FolderPlus className="w-4 h-4" />}
              tone="from-primary/30 to-primary/10 text-primary"
              onClick={() => setShowNewProject(true)}
            />
            <QuickAction
              label="Create Task"
              hint="Add to your list"
              icon={<CheckSquare className="w-4 h-4" />}
              tone="from-upflow-success/30 to-upflow-success/10 text-upflow-success"
              onClick={() => setShowNewTask(true)}
            />
            <QuickAction
              label="Invite to Team"
              hint="Bring teammates in"
              icon={<UserPlus className="w-4 h-4" />}
              tone="from-upflow-warning/30 to-upflow-warning/10 text-upflow-warning"
              onClick={() => setShowInvite(true)}
            />
            <QuickAction
              label="Schedule Meeting"
              hint="Today's agenda"
              icon={<Video className="w-4 h-4" />}
              tone="from-upflow-stat-2-from/40 to-upflow-stat-2-to/10 text-foreground"
              onClick={() => setShowSchedule(true)}
            />
            <QuickAction
              label="Create a Company"
              hint="Track an account"
              icon={<Building2 className="w-4 h-4" />}
              tone="from-upflow-danger/30 to-upflow-danger/10 text-upflow-danger"
              onClick={() => setShowCompany(true)}
            />
          </section>

          {/* Stat cards */}
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              tone="stat-1"
              label="Upcoming Actions"
              value={todoCount}
              accent="text-primary"
              icon={<FolderKanban className="w-5 h-5" />}
              hint="Tasks waiting to start"
              active={statusFilter === "todo"}
              onClick={() =>
                setStatusFilter((s) => (s === "todo" ? "all" : "todo"))
              }
            />
            <StatCard
              tone="stat-2"
              label="In progress Actions"
              value={inProgressCount}
              accent="text-upflow-warning"
              icon={<AlertCircle className="w-5 h-5" />}
              hint="Currently being worked on"
              active={statusFilter === "in_progress"}
              onClick={() =>
                setStatusFilter((s) => (s === "in_progress" ? "all" : "in_progress"))
              }
            />
            <StatCard
              tone="stat-3"
              label="Completed Actions"
              value={doneCount}
              accent="text-upflow-success"
              icon={<CheckCircle2 className="w-5 h-5" />}
              hint={`${progress}% of total`}
              active={statusFilter === "done"}
              onClick={() =>
                setStatusFilter((s) => (s === "done" ? "all" : "done"))
              }
            />
          </section>

          {/* Progress widget */}
          <section className="glass rounded-2xl p-5">
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
            <div
              className="group relative mt-4 h-2 rounded-full bg-white/5 overflow-visible cursor-help"
              title={`${doneCount} of ${tasks.length || 0} tasks complete`}
            >
              <div className="h-full rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-upflow-success transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-medium glass-strong opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {doneCount} / {tasks.length || 0} complete
              </span>
            </div>
          </section>

          {/* Team timeline */}
          <TeamTimeline users={users} loading={loading} statusFilter={statusFilter} />

          {/* Filtered tasks list */}
          <section className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {statusFilter === "all"
                    ? "Upcoming tasks"
                    : statusFilter === "todo"
                    ? "Upcoming"
                    : statusFilter === "in_progress"
                    ? "In progress"
                    : "Completed"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {statusFilter === "all"
                    ? "Sorted by due date"
                    : `Filtered by ${statusFilter.replace("_", " ")} · click the card again to reset`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {statusFilter !== "all" && (
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
                <button
                  onClick={() => setShowNewTask(true)}
                  className="text-xs text-primary hover:underline"
                >
                  + Add task
                </button>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="h-4 w-1/2 bg-white/5 rounded animate-pulse" />
                  </div>
                ))
              ) : filteredTasks.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Nothing here yet.
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={() => setActiveTask(task)}
                    onMarkDone={() => handleStatusChange(task, "done")}
                    onDelete={() => {
                      if (confirm(`Delete "${task.title}"?`)) handleDeleteTask(task);
                    }}
                    disabled={updating}
                  />
                ))
              )}
            </div>
          </section>

          {/* People */}
          <PeopleCard users={users} loading={loading} />
        </div>

        {/* Right panel */}
        <RightPanel
          projects={projects}
          userName={user?.name || "there"}
          extraMeetings={extraMeetings}
        />
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

      {showNewProject && (
        <NewProjectDialog
          open={showNewProject}
          onClose={() => setShowNewProject(false)}
          onCreated={() => {
            setShowNewProject(false);
            loadData();
            toast.success("Project created");
          }}
        />
      )}

      <InviteDialog open={showInvite} onClose={() => setShowInvite(false)} />

      <ScheduleMeetingDialog
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        onScheduled={(m) =>
          setExtraMeetings((prev) =>
            [...prev, m].sort((a, b) => a.time.localeCompare(b.time))
          )
        }
      />

      <CreateCompanyDialog
        open={showCompany}
        onClose={() => setShowCompany(false)}
      />

      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          updating={updating}
          onClose={() => setActiveTask(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteTask}
        />
      )}
    </>
  );
}

function TaskRow({
  task,
  onOpen,
  onMarkDone,
  onDelete,
  disabled,
}: {
  task: Task;
  onOpen: () => void;
  onMarkDone: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  return (
    <div className="group flex items-center gap-3 px-5 py-3.5 hover:bg-white/5 transition-colors">
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
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <p className="text-sm font-medium text-foreground truncate">
          {task.title}
        </p>
        {task.project?.name && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {task.project.name}
          </p>
        )}
      </button>
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
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Actions for ${task.title}`}
          aria-expanded={menuOpen}
          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-40 glass-strong rounded-lg z-30 overflow-hidden text-xs"
          >
            <button
              role="menuitem"
              type="button"
              disabled={disabled || task.status === "done"}
              onClick={() => {
                setMenuOpen(false);
                onMarkDone();
              }}
              className="w-full text-left px-3 py-2 hover:bg-white/5 disabled:opacity-40 focus:outline-none focus-visible:bg-white/10"
            >
              Mark done
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpen();
              }}
              className="w-full text-left px-3 py-2 hover:bg-white/5 border-t border-white/5 focus:outline-none focus-visible:bg-white/10"
            >
              Edit / details
            </button>
            <button
              role="menuitem"
              type="button"
              disabled={disabled}
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full text-left px-3 py-2 text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-40 border-t border-white/5 focus:outline-none focus-visible:bg-upflow-danger/15"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
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
  active,
  onClick,
}: {
  tone: "stat-1" | "stat-2" | "stat-3";
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  const wash =
    tone === "stat-1"
      ? "bg-gradient-to-br from-upflow-stat-1-from/35 via-upflow-stat-1-to/60 to-upflow-stat-1-to/40"
      : tone === "stat-2"
      ? "bg-gradient-to-br from-upflow-stat-2-from/35 via-upflow-stat-2-to/60 to-upflow-stat-2-to/40"
      : "bg-gradient-to-br from-upflow-stat-3-from/35 via-upflow-stat-3-to/60 to-upflow-stat-3-to/40";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 text-left glass transition-all hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/60",
        active && "ring-2 ring-primary/70"
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0", wash)} />
      <div className="pointer-events-none absolute -top-12 -right-10 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <p className="text-xs font-medium text-foreground/80 uppercase tracking-wide">
          {label}
        </p>
        <div
          className={cn(
            "flex items-center justify-center w-9 h-9 rounded-xl bg-background/40 backdrop-blur",
            accent
          )}
        >
          {icon}
        </div>
      </div>
      <h3 className="relative mt-3 text-3xl font-bold text-foreground">{value}</h3>
      <p className="relative mt-1 text-xs text-foreground/60">{hint}</p>
      {active && (
        <span className="relative mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-primary">
          Filtering ↓
        </span>
      )}
    </button>
  );
}

function TeamTimeline({
  users,
  loading,
  statusFilter,
}: {
  users: TeamMember[];
  loading: boolean;
  statusFilter: StatusFilter;
}) {
  // Map dashboard status filter onto mock block labels so the stat-card
  // selection visibly narrows the timeline as well.
  const statusToLabel: Record<Exclude<StatusFilter, "all">, string> = {
    todo: "Standup",
    in_progress: "Focus block",
    done: "Review",
  };
  const focusedLabel =
    statusFilter === "all" ? null : statusToLabel[statusFilter];
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i);
  const currentHour = new Date().getHours();
  const totalHours = 11;
  const [focusHour, setFocusHour] = useState<number | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
      }
    }
    if (optionsOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [optionsOpen]);

  const rows = useMemo(() => buildTimelineRows(users), [users]);

  const inFocusWindow = (h: number) =>
    focusHour !== null && Math.abs(h - focusHour) <= 2;

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Team timeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {focusedLabel && (
              <>
                {" · "}
                <span className="text-primary">Showing {focusedLabel.toLowerCase()}s</span>
              </>
            )}
            {focusHour !== null && (
              <>
                {" · "}
                <button
                  onClick={() => setFocusHour(null)}
                  className="text-primary hover:underline"
                >
                  Clear focus
                </button>
              </>
            )}
          </p>
        </div>
        <div className="relative" ref={optionsRef}>
          <button
            onClick={() => setOptionsOpen((v) => !v)}
            aria-label="Timeline options"
            aria-expanded={optionsOpen}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {optionsOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 w-52 glass-strong rounded-lg z-30 overflow-hidden text-xs"
            >
              <button
                role="menuitem"
                type="button"
                disabled={focusHour === null}
                onClick={() => {
                  setFocusHour(null);
                  setOptionsOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-white/5 disabled:opacity-40 focus:outline-none focus-visible:bg-white/10"
              >
                Clear focus window
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setCompact((v) => !v);
                  setOptionsOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-white/5 border-t border-white/5 focus:outline-none focus-visible:bg-white/10"
              >
                {compact ? "Comfortable density" : "Compact density"}
              </button>
              <Link
                role="menuitem"
                href="/team"
                onClick={() => setOptionsOpen(false)}
                className="block w-full text-left px-3 py-2 hover:bg-white/5 border-t border-white/5 focus:outline-none focus-visible:bg-white/10"
              >
                Open team page
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Hour pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 pl-[140px]">
        {hours.map((h) => {
          const isCurrent = h === currentHour;
          const isFocus = focusHour === h;
          const inWindow = inFocusWindow(h);
          return (
            <button
              key={h}
              onClick={() =>
                setFocusHour((f) => (f === h ? null : h))
              }
              aria-pressed={isFocus}
              title={`Focus around ${h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}`}
              className={cn(
                "flex-1 min-w-[44px] text-center px-2 py-1.5 text-xs rounded-lg font-medium transition-all hover:text-foreground",
                isFocus
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/60"
                  : isCurrent
                  ? "bg-primary/80 text-primary-foreground"
                  : inWindow
                  ? "bg-primary/20 text-foreground"
                  : "text-muted-foreground bg-white/5 hover:bg-white/10"
              )}
            >
              {h > 12 ? `${h - 12}pm` : h === 12 ? "12pm" : `${h}am`}
            </button>
          );
        })}
      </div>

      {/* Per-teammate rows */}
      <div className={cn("mt-2", compact ? "space-y-1" : "space-y-2")}>
        {loading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No teammates to show
          </div>
        ) : (
          rows.map(({ user: u, blocks, color }) => {
            const rowMatches = focusedLabel
              ? blocks.some((b) => b.label === focusedLabel)
              : true;
            return (
            <button
              key={u.id}
              onClick={() => toast(`Open ${u.name}'s schedule`)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg p-1 -mx-1 hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                !rowMatches && "opacity-30"
              )}
            >
              <div className="w-[128px] flex items-center gap-2 flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(u.name)}
                </div>
                <span className="text-xs text-foreground truncate text-left">{u.name}</span>
              </div>
              <div className={cn("relative flex-1 rounded-lg bg-white/5 overflow-hidden", compact ? "h-6" : "h-9")}>
                <div className="absolute inset-y-0 left-0 right-0 grid grid-cols-12">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className={cn(
                        "border-r border-white/5 last:border-r-0 transition-colors",
                        h === currentHour && "bg-primary/10",
                        focusHour !== null && inFocusWindow(h) && "bg-primary/15",
                        focusHour !== null && !inFocusWindow(h) && "opacity-50"
                      )}
                    />
                  ))}
                </div>
                {blocks.map((b, i) => {
                  const fmtH = (n: number) =>
                    n > 12 ? `${n - 12}pm` : n === 12 ? "12pm" : `${n}am`;
                  const dimByLabel =
                    focusedLabel !== null && b.label !== focusedLabel;
                  const dimByHour =
                    focusHour !== null &&
                    !(b.start <= focusHour + 2 && b.end >= focusHour - 2);
                  return (
                    <div
                      key={i}
                      title={`${u.name} · ${b.label} · ${fmtH(b.start)} – ${fmtH(b.end)}`}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-md border-l-2 px-2 flex items-center text-[10px] font-medium text-foreground/80 truncate transition-opacity",
                        color,
                        (dimByLabel || dimByHour) && "opacity-30"
                      )}
                      style={{
                        left: `calc(${((b.start - 8) / totalHours) * 100}% + 2px)`,
                        width: `calc(${Math.max(((b.end - b.start) / totalHours) * 100, 4)}% - 4px)`,
                      }}
                    >
                      {b.label}
                    </div>
                  );
                })}
              </div>
            </button>
            );
          })
        )}
      </div>
    </section>
  );
}

type TimerState = "stopped" | "running" | "paused";

function RightPanel({
  projects,
  userName,
  extraMeetings,
}: {
  projects: Project[];
  userName: string;
  extraMeetings: Meeting[];
}) {
  const [timerState, setTimerState] = useState<TimerState>("stopped");
  const [seconds, setSeconds] = useState(0);
  const [activeProjectIdx, setActiveProjectIdx] = useState(0);
  const [splits, setSplits] = useState<{ project: string; duration: string }[]>([]);
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);
  const timerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (timerMenuRef.current && !timerMenuRef.current.contains(e.target as Node)) {
        setTimerMenuOpen(false);
      }
    }
    if (timerMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [timerMenuOpen]);

  useEffect(() => {
    if (timerState !== "running") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerState]);

  const fmt = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const allMeetings = useMemo(
    () =>
      [...todayMeetings, ...extraMeetings].sort((a, b) =>
        a.time.localeCompare(b.time)
      ),
    [extraMeetings]
  );
  const am = allMeetings.filter((m) => parseInt(m.time) < 12);
  const pm = allMeetings.filter((m) => parseInt(m.time) >= 12);

  const [meetingsOpen, setMeetingsOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(todayMeetings.map((m) => [m.title, true]))
  );

  useEffect(() => {
    setMeetingsOpen((prev) => {
      const next = { ...prev };
      for (const m of extraMeetings) {
        if (!(m.title in next)) next[m.title] = true;
      }
      return next;
    });
  }, [extraMeetings]);

  const todayIdx = (() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  })();
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const recent = recentActions(userName);

  const filteredRecent = useMemo(() => {
    let list = recent;
    if (actionFilter !== "all") {
      list = list.filter((r) => r.status === actionFilter);
    }
    if (activeDay !== null) {
      list = list.filter((r) => r.dayIndex === activeDay);
    }
    return list;
  }, [recent, actionFilter, activeDay]);

  const activeProject = projects[activeProjectIdx]?.name || "No active project";

  const handleStart = () => setTimerState("running");
  const handlePause = () => setTimerState("paused");
  const handleStop = () => {
    if (seconds > 0) {
      setSplits((prev) => [
        { project: activeProject, duration: `${h}h ${m}m` },
        ...prev,
      ].slice(0, 4));
    }
    setTimerState("stopped");
    setSeconds(0);
  };

  const handleReset = () => {
    setTimerState("stopped");
    setSeconds(0);
    setTimerMenuOpen(false);
    toast.success("Timer reset");
  };

  const handleSwitchProject = () => {
    if (projects.length <= 1) {
      toast("No other projects to switch to");
      setTimerMenuOpen(false);
      return;
    }
    setActiveProjectIdx((i) => (i + 1) % projects.length);
    setTimerMenuOpen(false);
    toast.success(`Switched to ${projects[(activeProjectIdx + 1) % projects.length].name}`);
  };

  return (
    <aside className="hidden lg:flex w-[280px] flex-shrink-0 flex-col gap-4 p-6 border-l border-white/5">
      {/* Time tracking */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Time tracking
          </p>
          <div className="relative" ref={timerMenuRef}>
            <button
              onClick={() => setTimerMenuOpen((v) => !v)}
              aria-label="Time tracking options"
              aria-expanded={timerMenuOpen}
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {timerMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 glass-strong rounded-xl z-50 overflow-hidden text-xs">
                <button
                  onClick={handleReset}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-left"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset timer
                </button>
                <button
                  onClick={handleSwitchProject}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-left border-t border-white/5"
                >
                  <Repeat className="w-3.5 h-3.5" /> Switch project
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="font-mono text-3xl font-bold text-foreground tabular-nums">
          {fmt(h)}:{fmt(m)}:{fmt(s)}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">{activeProject}</p>
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
            onClick={handleStop}
            disabled={timerState === "stopped"}
            aria-label="Stop timer"
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-upflow-danger text-white hover:bg-upflow-danger/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shadow-upflow-danger/30"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
          <button
            onClick={handlePause}
            disabled={timerState !== "running"}
            aria-label="Pause timer"
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-white/5 text-foreground hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
        </div>
        {splits.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Recent splits
            </p>
            <ul className="space-y-1">
              {splits.map((sp, i) => (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/80 truncate pr-2">{sp.project}</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {sp.duration}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Today's meetings */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Today meetings
          </p>
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
        </div>

        {[
          { label: "AM", items: am },
          { label: "PM", items: pm },
        ].map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((mt) => {
                    const open = meetingsOpen[mt.title];
                    return (
                      <div
                        key={mt.title}
                        className="flex items-center gap-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors -mx-2 px-2"
                      >
                        <button
                          onClick={() => toast(`Joining ${mt.title}…`, { icon: "📹" })}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <span className="font-mono text-xs font-semibold text-foreground/90 tabular-nums w-12 flex-shrink-0">
                            {mt.time}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground truncate">
                              {mt.title}
                            </p>
                          </div>
                          <Video className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        </button>
                        <button
                          onClick={() =>
                            setMeetingsOpen((s) => ({
                              ...s,
                              [mt.title]: !s[mt.title],
                            }))
                          }
                          aria-pressed={open}
                          aria-label={`Toggle ${mt.title}`}
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0",
                            open ? "bg-primary" : "bg-white/10"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                              open ? "translate-x-[18px]" : "translate-x-[3px]"
                            )}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
        )}
        <Link
          href="/calendar"
          className="inline-block text-xs text-primary hover:text-primary/80 mt-1"
        >
          View all →
        </Link>
      </div>

      {/* Activity */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Activity
          </p>
          {activeDay !== null ? (
            <button
              onClick={() => setActiveDay(null)}
              className="text-[10px] text-primary hover:underline"
            >
              Clear
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Last week</span>
          )}
        </div>
        <div className="flex items-end justify-between gap-1.5">
          {weekActivity.map((d, i) => {
            const isToday = i === todayIdx;
            const isActive = activeDay === i;
            return (
              <div
                key={d.day}
                className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
              >
                <button
                  type="button"
                  onClick={() => setActiveDay((c) => (c === i ? null : i))}
                  aria-pressed={isActive}
                  title={`${d.hours}h · ${d.tasks} tasks`}
                  className={cn(
                    "group relative w-full flex flex-col items-center justify-end gap-1 py-2 rounded-full min-h-[96px] transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50",
                    isActive
                      ? "bg-primary/25 ring-2 ring-primary/60"
                      : isToday
                      ? "bg-primary/15 ring-1 ring-primary/30"
                      : "bg-white/5"
                  )}
                >
                  {d.items.map((dot, di) => (
                    <span
                      key={di}
                      className={cn("rounded-full block", dot.color)}
                      style={{
                        width: `${dot.size}px`,
                        height: `${dot.size}px`,
                        opacity: 0.85,
                      }}
                    />
                  ))}
                  <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-medium glass-strong opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {d.hours}h · {d.tasks} tasks
                  </span>
                </button>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isActive
                      ? "text-primary"
                      : isToday
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Last actions */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Last actions
          </p>
        </div>
        <div className="flex items-center gap-1 mb-3">
          {(["all", "completed", "in_progress"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActionFilter(f)}
              aria-pressed={actionFilter === f}
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full transition-colors",
                actionFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              )}
            >
              {f === "all" ? "All" : f === "completed" ? "Done" : "Active"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filteredRecent.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No matching activity.
            </p>
          ) : (
            filteredRecent.map((r, i) => (
              <button
                key={i}
                onClick={() => toast(`${r.who} — ${r.what} ${r.target}`)}
                className="w-full flex items-start gap-3 -mx-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(r.who)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground truncate">
                      {r.who}
                    </p>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0",
                        r.status === "completed"
                          ? "bg-upflow-success/20 text-upflow-success"
                          : "bg-upflow-warning/20 text-upflow-warning"
                      )}
                    >
                      {r.status === "completed" ? "Completed" : "In progress"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug truncate">
                    {r.what} {r.target}
                  </p>
                  <p className="text-[11px] text-muted-foreground/90 mt-0.5">
                    {r.when}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
        <button
          onClick={() => toast("All activity view coming soon")}
          className="text-xs text-primary hover:text-primary/80 mt-3"
        >
          View all →
        </button>
      </div>
    </aside>
  );
}

function TaskDetailModal({
  task,
  updating,
  onClose,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  updating: boolean;
  onClose: () => void;
  onStatusChange: (task: Task, status: Task["status"]) => void;
  onDelete: (task: Task) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = `task-modal-title-${task.id}`;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md glass-strong rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {task.project?.name || "Task"}
            </p>
            <h3 id={titleId} className="mt-1 text-lg font-bold text-foreground">{task.title}</h3>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "px-2 py-1 rounded-full font-medium",
              priorityColor(task.priority)
            )}
          >
            {task.priority}
          </span>
          <span className="px-2 py-1 rounded-full bg-white/5 text-foreground/80 capitalize">
            {task.status.replace("_", " ")}
          </span>
          {task.due_date && (
            <span
              className={cn(
                "px-2 py-1 rounded-full bg-white/5",
                isOverdue(task.due_date) && task.status !== "done"
                  ? "text-upflow-danger"
                  : "text-foreground/80"
              )}
            >
              Due {formatDate(task.due_date)}
            </span>
          )}
        </div>
        {task.description && (
          <p className="mt-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        )}
        <div className="mt-6 grid grid-cols-3 gap-2">
          <button
            onClick={() => onStatusChange(task, "todo")}
            disabled={updating || task.status === "todo"}
            className="text-xs font-medium py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            To do
          </button>
          <button
            onClick={() => onStatusChange(task, "in_progress")}
            disabled={updating || task.status === "in_progress"}
            className="text-xs font-medium py-2 rounded-xl bg-upflow-warning/20 text-upflow-warning hover:bg-upflow-warning/30 disabled:opacity-40 transition-colors"
          >
            In progress
          </button>
          <button
            onClick={() => onStatusChange(task, "done")}
            disabled={updating || task.status === "done"}
            className="text-xs font-medium py-2 rounded-xl bg-upflow-success/20 text-upflow-success hover:bg-upflow-success/30 disabled:opacity-40 transition-colors"
          >
            Mark done
          </button>
        </div>
        <button
          onClick={() => {
            if (confirm(`Delete "${task.title}"?`)) onDelete(task);
          }}
          disabled={updating}
          className="mt-3 w-full text-xs font-medium py-2 rounded-xl text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-40 transition-colors"
        >
          Delete task
        </button>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  hint,
  icon,
  tone,
  onClick,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-4 text-left glass transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/60"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
          tone
        )}
      />
      <div className="pointer-events-none absolute -top-8 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-center gap-2.5">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg bg-background/40 backdrop-blur",
            tone.split(" ").find((c) => c.startsWith("text-")) || "text-foreground"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wide truncate">
            {label}
          </p>
          <p className="text-[10px] text-foreground/60 truncate">{hint}</p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-foreground/50 group-hover:text-foreground transition-colors flex-shrink-0" />
      </div>
    </button>
  );
}

function PeopleCard({
  users,
  loading,
}: {
  users: TeamMember[];
  loading: boolean;
}) {
  return (
    <section className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-foreground">
          People ({users.length})
        </h3>
        <Link href="/team" className="text-xs text-primary hover:underline">
          View all →
        </Link>
      </div>
      <div className="p-3">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No teammates yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {users.slice(0, 9).map((u) => (
              <Link
                key={u.id}
                href="/team"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {u.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.avatar_url}
                    alt={u.name}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(u.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {u.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {u.email}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
