"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { logError } from "@/lib/log-error";
import type { Project, TaskAssignee } from "@/lib/types";
import { buildTaskBrief, DEFAULT_TASK_TEMPLATE_ID, type TaskTemplateId } from "@/lib/task-templates";
import TaskTemplateFields from "@/components/projects/task-template-fields";
import { useLanguage } from "@/components/language-provider";
import BrazilianDateInput from "@/components/ui/brazilian-date-input";

interface NewTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId?: string;
  defaultStatus?: string;
  defaultTemplateId?: TaskTemplateId;
}

export default function NewTaskDialog({
  open,
  onClose,
  onCreated,
  projectId,
  defaultStatus = "todo",
  defaultTemplateId = DEFAULT_TASK_TEMPLATE_ID,
}: NewTaskDialogProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskTemplateId, setTaskTemplateId] =
    useState<TaskTemplateId>(defaultTemplateId);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedProject, setSelectedProject] = useState(projectId || "");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [users, setUsers] = useState<TaskAssignee[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedProjectName = projects.find((project) => project.id === selectedProject)?.name;
  const projectIsPreset = Boolean(projectId);
  const projectSelectionLoading = !projectIsPreset && projectsLoading;

  useEffect(() => {
    if (!open) return;
    setSelectedProject(projectId || "");
    setTaskTemplateId(defaultTemplateId);
    setTemplateValues({});
    setProjectsLoading(true);
    setProjectsError(null);
    fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load available lists.");
        return r.json() as Promise<{ items: Project[] }>;
      })
      .then((p) => {
        setProjects(p.items ?? []);
      })
      .catch((err) => {
        logError("new-task-dialog:load", err);
        setProjects([]);
        setProjectsError("Could not load lists. Close and reopen this dialog, then try again.");
        toast.error("Could not load available lists. Try again before creating the task.");
      })
      .finally(() => {
        setProjectsLoading(false);
      });
  }, [open, projectId, defaultTemplateId]);

  useEffect(() => {
    if (!open || !selectedProject) {
      setUsers([]);
      return;
    }
    const project = projects.find((p) => p.id === selectedProject);
    if (!project?.workspace_id) {
      setUsers([]);
      return;
    }
    fetch(`/api/users?workspace_id=${project.workspace_id}&status=active`)
      .then((r) => r.json() as Promise<{ items: TaskAssignee[] }>)
      .then((u) => setUsers(u.items ?? []))
      .catch((err) => {
        logError("new-task-dialog:load-users", err);
        toast.error("Could not load assignees for this project.");
      });
  }, [open, projects, selectedProject]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error("Add a clear task title before creating it.");
      return;
    }
    if (!selectedProject) {
      toast.error("Choose the list or campaign where this task belongs.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: buildTaskBrief({
            templateId: taskTemplateId,
            values: templateValues,
            notes: description,
          }),
          priority,
          status: defaultStatus,
          project_id: selectedProject,
          assignee_id: assigneeId || null,
          due_date: dueDate || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || t("task.failedCreate"));
      }
      setTitle("");
      setDescription("");
      setTaskTemplateId(defaultTemplateId);
      setTemplateValues({});
      setPriority("medium");
      setDueDate("");
      setAssigneeId("");
      toast.success(`${cleanTitle} created${selectedProjectName ? ` in ${selectedProjectName}` : ""}`);
      onCreated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("task.failedCreate");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("task.newTask")}
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Create deliverable</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add client work, campaign actions, creative requests, or internal agency operations.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Deliverable / action title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Approve Meta Ads creative set"
              aria-required="true"
              autoFocus
              className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {!projectId && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Client work / campaign list <span className="text-destructive">*</span>
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                aria-required="true"
                disabled={loading || projectsLoading}
                className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  {projectsLoading ? "Loading lists..." : "Choose where this deliverable belongs"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {projectsError ? (
                <p className="mt-1 text-xs text-upflow-danger">{projectsError}</p>
              ) : !projectsLoading && projects.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No lists are available yet. Create a project/list first, then add tasks.
                </p>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Context and acceptance notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief, links, client expectations, approval notes, or performance context"
              rows={2}
              className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <TaskTemplateFields
            templateId={taskTemplateId}
            values={templateValues}
            onTemplateChange={setTaskTemplateId}
            onValuesChange={setTemplateValues}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("toolbar.priority")}</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">{t("priority.low")}</option>
                <option value="medium">{t("priority.medium")}</option>
                <option value="high">{t("priority.high")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("toolbar.assignee")}</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("common.unassigned")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("toolbar.dueDate")}</label>
            <BrazilianDateInput
              value={dueDate}
              onChange={setDueDate}
              className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use the real client deadline. This powers dashboard risk and delivery views.
              {selectedProjectName ? ` Selected list: ${selectedProjectName}.` : ""}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-white/10 text-foreground text-sm font-medium py-2.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading || projectSelectionLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? t("common.creating") : t("task.createTask")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
