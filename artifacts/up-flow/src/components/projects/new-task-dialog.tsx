"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { logError } from "@/lib/log-error";
import type { Project, TaskAssignee } from "@/lib/types";
import {
  buildTaskBrief,
  DEFAULT_TASK_TEMPLATE_ID,
  getTaskTitleFromTemplateValues,
  type TaskTemplateId,
} from "@/lib/task-templates";
import TaskTemplateFields from "@/components/projects/task-template-fields";
import TaskAssigneePicker from "@/components/projects/task-assignee-picker";
import { PriorityPicker, type TaskPriority } from "@/components/projects/priority-ui";
import { useLanguage } from "@/components/language-provider";
import BrazilianDateInput from "@/components/ui/brazilian-date-input";

interface NewTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId?: string;
  defaultStatus?: string;
  defaultTemplateId?: TaskTemplateId;
  defaultDueDate?: string;
}

export default function NewTaskDialog({
  open,
  onClose,
  onCreated,
  projectId,
  defaultStatus = "todo",
  defaultTemplateId = DEFAULT_TASK_TEMPLATE_ID,
  defaultDueDate = "",
}: NewTaskDialogProps) {
  const { language, t } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskTemplateId, setTaskTemplateId] =
    useState<TaskTemplateId>(defaultTemplateId);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedProject, setSelectedProject] = useState(projectId || "");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [users, setUsers] = useState<TaskAssignee[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedProjectName = projects.find((project) => project.id === selectedProject)?.name;
  const selectedAssigneeName = users.find((user) => user.id === assigneeId)?.name;
  const projectIsPreset = Boolean(projectId);
  const projectSelectionLoading = !projectIsPreset && projectsLoading;

  useEffect(() => {
    if (!open) return;
    setSelectedProject(projectId || "");
    setTaskTemplateId(defaultTemplateId);
    setTemplateValues({});
    setDueDate(defaultDueDate);
    setProjectsLoading(true);
    setProjectsError(null);
    fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error(t("task.couldNotLoadLists"));
        return r.json() as Promise<{ items: Project[] }>;
      })
      .then((p) => {
        setProjects(p.items ?? []);
      })
      .catch((err) => {
        logError("new-task-dialog:load", err);
        setProjects([]);
        setProjectsError(t("task.listLoadError"));
        toast.error(t("task.couldNotLoadLists"));
      })
      .finally(() => {
        setProjectsLoading(false);
      });
  }, [open, projectId, defaultTemplateId, defaultDueDate, t]);

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
        toast.error(t("task.couldNotLoadAssignees"));
      });
  }, [open, projects, selectedProject, t]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const cleanTitle = title.trim() || getTaskTitleFromTemplateValues(templateValues);
    if (!cleanTitle) {
      toast.error(t("task.titleOrObjectiveRequired"));
      return;
    }
    if (!selectedProject) {
      toast.error(t("task.chooseList"));
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
            locale: language,
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
      await res.json().catch(() => null);
      setTitle("");
      setDescription("");
      setTaskTemplateId(defaultTemplateId);
      setTemplateValues({});
      setPriority("medium");
      setDueDate(defaultDueDate);
      setAssigneeId("");
      toast.success(
        [
          selectedProjectName
            ? t("task.createdInList", {
                title: cleanTitle,
                location: t("common.inLocation", { location: selectedProjectName }),
              })
            : t("task.created", { title: cleanTitle }),
          selectedAssigneeName
            ? t("task.assigneeNotified", { name: selectedAssigneeName })
            : t("task.noAssigneeSelected"),
        ].join(" "),
      );
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
            <h2 className="text-lg font-semibold text-foreground">{t("task.createTask")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("task.createDeliverableSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label={t("common.close")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("task.deliverableActionTitle")} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("task.deliverableActionPlaceholder")}
              aria-required="true"
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("task.structuredTitleHint")}
            </p>
          </div>

          {!projectId && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t("task.clientWorkList")} <span className="text-destructive">*</span>
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                aria-required="true"
                disabled={loading || projectsLoading}
                className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground backdrop-blur focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
              >
                <option value="">
                  {projectsLoading ? t("task.loadingLists") : t("task.chooseDeliverableList")}
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
                  {t("task.noListsAvailable")}
                </p>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("task.contextNotes")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("task.contextNotesPlaceholder")}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
            />
          </div>

          <TaskTemplateFields
            templateId={taskTemplateId}
            values={templateValues}
            onTemplateChange={setTaskTemplateId}
            onValuesChange={setTemplateValues}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">{t("toolbar.priority")}</label>
              <PriorityPicker value={priority} onChange={setPriority} t={t} />
            </div>
            <div className="sm:col-span-2">
              <TaskAssigneePicker
                value={assigneeId}
                users={users}
                onChange={setAssigneeId}
                disabled={loading || !selectedProject}
                label={t("toolbar.assignee")}
                emptyLabel={t("common.unassigned")}
                mode="create"
                selectClassName="border-border bg-background backdrop-blur dark:border-white/10 dark:bg-white/5"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("toolbar.dueDate")}</label>
            <BrazilianDateInput
              value={dueDate}
              onChange={setDueDate}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground backdrop-blur focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("task.dueDateHint")}
              {selectedProjectName ? ` ${t("task.selectedList", { name: selectedProjectName })}` : ""}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent dark:border-white/10 dark:hover:bg-white/10"
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
