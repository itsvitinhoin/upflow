"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { logError } from "@/lib/log-error";
import type { Project, TaskAssignee } from "@/lib/types";
import { buildTaskBrief, DEFAULT_TASK_TEMPLATE_ID, type TaskTemplateId } from "@/lib/task-templates";
import TaskTemplateFields from "@/components/projects/task-template-fields";

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
  const [users, setUsers] = useState<TaskAssignee[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedProject(projectId || "");
    setTaskTemplateId(defaultTemplateId);
    setTemplateValues({});
    fetch("/api/projects")
      .then((r) => r.json() as Promise<{ items: Project[] }>)
      .then((p) => {
        setProjects(p.items ?? []);
      })
      .catch((err) => logError("new-task-dialog:load", err));
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
      .catch((err) => logError("new-task-dialog:load-users", err));
  }, [open, projects, selectedProject]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedProject) {
      toast.error("Please provide a title and select a project");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
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
        throw new Error(data.error || "Failed to create task");
      }
      setTitle("");
      setDescription("");
      setTaskTemplateId(defaultTemplateId);
      setTemplateValues({});
      setPriority("medium");
      setDueDate("");
      setAssigneeId("");
      onCreated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create task";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New Task"
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">New Task</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Task title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design login screen"
              required
              autoFocus
              className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {!projectId && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Project <span className="text-destructive">*</span>
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                required
                className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
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
              <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-white/10 bg-white/5 backdrop-blur rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-white/10 text-foreground text-sm font-medium py-2.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
