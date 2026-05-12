"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FolderOpen, Plus, Calendar, CheckSquare, Folder } from "lucide-react";
import Header from "@/components/layout/header";
import NewProjectDialog from "@/components/projects/new-project-dialog";
import { cn, formatDate, getInitials, statusColor, statusLabel } from "@/lib/utils";
import type { Project, Space } from "@/lib/types";

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.get("search") ?? "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [moveProjectId, setMoveProjectId] = useState<string | null>(null);

  const loadProjects = () => {
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const loadSpaces = () => {
    fetch("/api/spaces")
      .then((r) => r.json())
      .then((data: Space[]) => setSpaces(data))
      .catch(() => {});
  };

  useEffect(() => {
    loadProjects();
    loadSpaces();
  }, []);

  const moveProject = async (projectId: string, spaceId: string | null) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_id: spaceId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Project moved");
      setMoveProjectId(null);
      loadProjects();
    } catch {
      toast.error("Could not move project");
    }
  };

  const filtered = projects.filter(
    (p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Header title="Projects" />
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">All Projects</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No projects found</p>
            <p className="text-sm mt-1">Create your first project to get started</p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all"
              >
                <Link href={`/projects/${project.id}`} className="block">
                  <div className="flex items-start justify-between mb-3 pr-8">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2",
                        statusColor(project.status)
                      )}
                    >
                      {statusLabel(project.status)}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {getInitials(project.owner?.name || "?")}
                      </div>
                      <span className="text-xs text-muted-foreground">{project.owner?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {project.space && (
                        <span className="flex items-center gap-1">
                          <Folder className="w-3 h-3" />
                          {project.space.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" />
                        {project._count?.tasks || 0}
                      </span>
                      {project.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(project.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMoveProjectId(project.id);
                  }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground bg-background/80 border border-border rounded-md px-2 py-1 flex items-center gap-1 transition-opacity"
                  title="Move to space"
                >
                  <Folder className="w-3 h-3" /> Move
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={() => {
          setShowNew(false);
          loadProjects();
          toast.success("Project created!");
        }}
      />

      {moveProjectId && (
        <MoveToSpaceDialog
          project={projects.find((p) => p.id === moveProjectId)!}
          spaces={spaces}
          onClose={() => setMoveProjectId(null)}
          onMove={(spaceId) => moveProject(moveProjectId, spaceId)}
        />
      )}
    </>
  );
}

function MoveToSpaceDialog({
  project,
  spaces,
  onClose,
  onMove,
}: {
  project: Project;
  spaces: Space[];
  onClose: () => void;
  onMove: (spaceId: string | null) => void;
}) {
  const [target, setTarget] = useState<string>(project.space_id ?? "");
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-foreground">Move project</h3>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4 truncate">{project.name}</p>
        <label className="block text-xs font-medium text-foreground mb-1.5">Space</label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Unassigned —</option>
          {spaces.map((sp) => (
            <option key={sp.id} value={sp.id}>
              {sp.icon || "🗂️"} {sp.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => onMove(target || null)}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
