"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderKanban,
  FolderPlus,
  CheckSquare,
  Plus,
  ArrowRight,
} from "lucide-react";
import Header from "@/components/layout/header";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import NewTaskDialog from "@/components/projects/new-task-dialog";
import {
  cn,
  formatDate,
  getInitials,
  isOverdue,
  priorityColor,
} from "@/lib/utils";
import type { Task } from "@/lib/types";

interface SpaceMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
}

interface SpaceProject {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  due_date: string | null;
  folder: { id: string; name: string; icon: string | null } | null;
  _count: { tasks: number };
  task_breakdown: { todo: number; in_progress: number; done: number };
}

interface SpaceDashboardData {
  space: {
    id: string;
    name: string;
    icon: string | null;
    owner: { id: string; name: string; email: string };
    _count: { projects: number };
  };
  folders: { id: string; name: string }[];
  projects: SpaceProject[];
  members: SpaceMember[];
  stats: {
    total_projects: number;
    total_tasks: number;
    todo: number;
    in_progress: number;
    done: number;
    overdue: number;
  };
  recent_tasks: Task[];
}

export default function SpaceDashboardPage() {
  const params = useParams();
  const id = (params?.id ?? "") as string;
  const [data, setData] = useState<SpaceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFoundState, setNotFoundState] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${id}`);
      if (res.status === 404) {
        setNotFoundState(true);
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load");
      }
      const json = (await res.json()) as SpaceDashboardData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const firstProjectId = useMemo(
    () => data?.projects[0]?.id ?? undefined,
    [data?.projects],
  );

  // Trigger Next's built-in 404 boundary when the API confirms the Space
  // isn't visible to the caller (either doesn't exist or lives in another
  // workspace). Using notFound() rather than a redirect keeps the URL the
  // user typed visible and renders the standard not-found UI.
  if (notFoundState) {
    notFound();
  }

  if (loading) {
    return <SpaceDashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <>
        <Header title="Space" />
        <div className="p-6">
          <div className="glass rounded-2xl p-6 max-w-lg">
            <h2 className="text-lg font-semibold text-foreground">
              Couldn&apos;t load this Space
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Something went wrong while fetching the Space. Try again in a
              moment.
            </p>
            <button
              onClick={loadData}
              className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  const { space, projects, members, stats, recent_tasks } = data;
  const progress = stats.total_tasks
    ? Math.round((stats.done / stats.total_tasks) * 100)
    : 0;

  return (
    <>
      <Header title={space.name} />
      <div className="p-6 space-y-6">
        {/* Space header */}
        <section className="glass rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 text-3xl flex-shrink-0">
                {space.icon || "🗂️"}
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-foreground truncate">
                  {space.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.total_projects}{" "}
                  {stats.total_projects === 1 ? "project" : "projects"} ·{" "}
                  {members.length}{" "}
                  {members.length === 1 ? "member" : "members"} · Owned by{" "}
                  {space.owner.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewProject(true)}
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                New project
              </button>
              <button
                onClick={() => setShowNewTask(true)}
                disabled={!firstProjectId}
                title={
                  firstProjectId
                    ? "Create a task in this Space"
                    : "Create a project first to add tasks"
                }
                className="inline-flex items-center gap-2 border border-white/10 text-foreground hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                New task
              </button>
            </div>
          </div>
        </section>

        {/* Stat cards */}
        <section className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <StatCard
            label="Projects"
            value={stats.total_projects}
            icon={<FolderKanban className="w-5 h-5" />}
            accent="text-primary"
          />
          <StatCard
            label="Open"
            value={stats.todo}
            icon={<Clock className="w-5 h-5" />}
            accent="text-muted-foreground"
          />
          <StatCard
            label="In progress"
            value={stats.in_progress}
            icon={<AlertCircle className="w-5 h-5" />}
            accent="text-upflow-warning"
          />
          <StatCard
            label="Completed"
            value={stats.done}
            icon={<CheckCircle2 className="w-5 h-5" />}
            accent="text-upflow-success"
            hint={`${progress}% of total`}
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            icon={<AlertCircle className="w-5 h-5" />}
            accent="text-upflow-danger"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Projects in this Space */}
          <section className="glass rounded-2xl overflow-hidden lg:col-span-2">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Projects in this Space
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {projects.length}{" "}
                  {projects.length === 1 ? "project" : "projects"}
                </p>
              </div>
              <button
                onClick={() => setShowNewProject(true)}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add project
              </button>
            </div>
            <div className="p-4">
              {projects.length === 0 ? (
                <div className="px-2 py-10 text-center">
                  <p className="text-sm text-foreground font-medium">
                    No projects in this Space yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create your first project to start tracking work here.
                  </p>
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="mt-4 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Create a project
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {projects.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Recent tasks */}
          <section className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-foreground">
                Recent activity
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Latest tasks in this Space
              </p>
            </div>
            <div className="divide-y divide-white/5">
              {recent_tasks.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No recent tasks yet.
                </div>
              ) : (
                recent_tasks.map((task) => (
                  <RecentTaskRow key={task.id} task={task} />
                ))
              )}
            </div>
          </section>
        </div>

        {/* Members strip */}
        <section className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-foreground">
              Members ({members.length})
            </h3>
            <Link href="/team" className="text-xs text-primary hover:underline">
              View team →
            </Link>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-2">
                No members yet.
              </p>
            ) : (
              members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-full bg-white/5"
                  title={`${m.name} · ${m.role}`}
                >
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center">
                      {getInitials(m.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate max-w-[140px]">
                      {m.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {m.role}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {showNewProject && (
        <NewProjectDialog
          open={showNewProject}
          onClose={() => setShowNewProject(false)}
          onCreated={() => {
            setShowNewProject(false);
            loadData();
          }}
          defaultSpaceId={space.id}
        />
      )}

      {showNewTask && firstProjectId && (
        <NewTaskDialog
          open={showNewTask}
          onClose={() => setShowNewTask(false)}
          onCreated={() => {
            setShowNewTask(false);
            loadData();
          }}
          projectId={firstProjectId}
        />
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
  hint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground/80 uppercase tracking-wide">
          {label}
        </p>
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg bg-background/40 backdrop-blur",
            accent,
          )}
        >
          {icon}
        </div>
      </div>
      <h3 className="mt-3 text-2xl font-bold text-foreground">{value}</h3>
      {hint && <p className="mt-1 text-xs text-foreground/60">{hint}</p>}
    </div>
  );
}

function ProjectCard({ project }: { project: SpaceProject }) {
  const total =
    project.task_breakdown.todo +
    project.task_breakdown.in_progress +
    project.task_breakdown.done;
  const pct = total ? Math.round((project.task_breakdown.done / total) * 100) : 0;
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/5 hover:border-white/10 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {project.name}
          </p>
          {project.folder && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              📁 {project.folder.name}
            </p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
      </div>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{project._count.tasks} tasks</span>
        <span>·</span>
        <span>{project.task_breakdown.in_progress} in progress</span>
        <span>·</span>
        <span>{project.task_breakdown.done} done</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-upflow-success"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{pct}% complete</p>
    </Link>
  );
}

function RecentTaskRow({ task }: { task: Task }) {
  return (
    <Link
      href={`/projects/${task.project?.id ?? ""}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors"
    >
      <div
        className={cn(
          "w-1.5 h-8 rounded-full flex-shrink-0",
          task.priority === "high"
            ? "bg-upflow-danger"
            : task.priority === "medium"
              ? "bg-upflow-warning"
              : "bg-muted-foreground/40",
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
          "text-[10px] px-2 py-0.5 rounded-full font-medium",
          priorityColor(task.priority),
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
              "text-upflow-danger font-medium",
          )}
        >
          {formatDate(task.due_date)}
        </span>
      )}
    </Link>
  );
}

function SpaceDashboardSkeleton() {
  return (
    <>
      <Header title="Space" />
      <div className="p-6 space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Loading…</span>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-48 bg-white/5 rounded animate-pulse" />
              <div className="h-3 w-72 bg-white/5 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 glass rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-64 glass rounded-2xl animate-pulse" />
          <div className="h-64 glass rounded-2xl animate-pulse" />
        </div>
      </div>
    </>
  );
}
