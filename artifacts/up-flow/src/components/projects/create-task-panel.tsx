"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import CustomFieldInput from "@/components/projects/custom-field-input";
import TaskCoverImageControl from "@/components/projects/task-cover-image-control";
import TaskTemplateFields from "@/components/projects/task-template-fields";
import TaskAssigneePicker from "@/components/projects/task-assignee-picker";
import { PriorityPicker, type TaskPriority } from "@/components/projects/priority-ui";
import BrazilianDateInput from "@/components/ui/brazilian-date-input";
import {
  buildTaskBrief,
  DEFAULT_TASK_TEMPLATE_ID,
  getTaskTitleFromTemplateValues,
  type TaskTemplateId,
} from "@/lib/task-templates";
import type { CustomFieldDefinition, TaskAssignee } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultStatus?: "todo" | "in_progress" | "done";
  initialCustomFieldValues?: Record<string, unknown>;
  customFields: CustomFieldDefinition[];
  users: TaskAssignee[];
  onCreated: () => void;
}

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do", dot: "bg-muted-foreground/60" },
  { value: "in_progress", label: "In Progress", dot: "bg-primary" },
  { value: "done", label: "Done", dot: "bg-upflow-success" },
] as const;

function statusOptionLabel(
  status: (typeof STATUS_OPTIONS)[number]["value"],
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (status === "todo") return t("status.todo");
  if (status === "in_progress") return t("status.inProgress");
  return t("status.done");
}

export default function CreateTaskPanel({
  open,
  onClose,
  projectId,
  defaultStatus = "todo",
  initialCustomFieldValues,
  customFields,
  users,
  onCreated,
}: Props) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskTemplateId, setTaskTemplateId] =
    useState<TaskTemplateId>(DEFAULT_TASK_TEMPLATE_ID);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"todo" | "in_progress" | "done">(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const selectedAssigneeName = users.find((user) => user.id === assigneeId)?.name;

  useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
      setFieldValues(initialCustomFieldValues ?? {});
    } else {
      setTitle("");
      setDescription("");
      setTaskTemplateId(DEFAULT_TASK_TEMPLATE_ID);
      setTemplateValues({});
      setPriority("medium");
      setDueDate("");
      setCoverImageUrl(null);
      setAssigneeId("");
      setFieldValues({});
    }
  }, [open, defaultStatus, initialCustomFieldValues]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const cleanTitle = title.trim() || getTaskTitleFromTemplateValues(templateValues);
    if (!cleanTitle) {
      toast.error("Add a deliverable title or fill Objective before creating it.");
      return;
    }
    setSubmitting(true);
    try {
      const customFieldEntries = Object.entries(fieldValues)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([definition_id, value]) => ({ definition_id, value }));

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
          status,
          priority,
          project_id: projectId,
          assignee_id: assigneeId || null,
          due_date: dueDate || null,
          cover_image_url: coverImageUrl,
          custom_fields: customFieldEntries,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("task.failedCreate"));
      }
      await res.json().catch(() => null);

      onCreated();
      toast.success(
        selectedAssigneeName
          ? `${t("dashboard.taskCreated")} ${selectedAssigneeName} was notified.`
          : `${t("dashboard.taskCreated")} No assignee selected yet.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const activeStatus = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <form
        onSubmit={submit}
        noValidate
        className="fixed right-0 top-0 z-50 flex h-dvh w-full flex-col border-l border-border bg-background shadow-2xl sm:max-w-[520px]"
      >
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
            <ListTodo className="w-3.5 h-3.5" />
            {t("task.newTask")}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close task creation"
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-5 pb-4 border-b border-border">
            <div className="flex items-start gap-3 mb-3">
              <button
                type="button"
                onClick={() => {
                  const idx = STATUS_OPTIONS.findIndex((s) => s.value === status);
                  setStatus(STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length].value);
                }}
                className="flex items-center gap-1.5 mt-2 text-xs px-2 py-1 rounded-md border border-border hover:bg-muted"
                title={t("task.clickCycleStatus")}
              >
                <span className={cn("w-2 h-2 rounded-full", activeStatus.dot)} />
                {statusOptionLabel(activeStatus.value, t)}
              </button>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${t("task.taskName")} or use Objective below`}
                autoFocus
                aria-required="true"
                className="flex-1 bg-transparent text-xl font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none py-1"
              />
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Add a direct title here, or fill the Objective/Deliverable field below and UP Flow will use it as the title.
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t("task.notesPlaceholder")}
              className="w-full text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none resize-none border border-transparent hover:border-border focus:border-border rounded-md px-2 py-1.5 -mx-2"
            />
            <div className="mt-4">
              <TaskTemplateFields
                templateId={taskTemplateId}
                values={templateValues}
                onTemplateChange={setTaskTemplateId}
                onValuesChange={setTemplateValues}
              />
            </div>
          </div>

          <div className="px-5 py-4 space-y-3 border-b border-border">
            <TaskAssigneePicker
              value={assigneeId}
              users={users}
              onChange={setAssigneeId}
              disabled={submitting}
              label={t("toolbar.assignee")}
              emptyLabel={t("common.unassigned")}
              mode="create"
            />
            <Row label={t("toolbar.dueDate")}>
              <BrazilianDateInput
                value={dueDate}
                onChange={setDueDate}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
              />
            </Row>
            <Row label={t("toolbar.priority")}>
              <PriorityPicker value={priority} onChange={setPriority} t={t} />
            </Row>
          </div>

          <div className="px-5 py-4 border-b border-border">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("task.boardCoverImage")}
            </h3>
            <TaskCoverImageControl
              value={coverImageUrl}
              disabled={submitting}
              onChange={(value) => setCoverImageUrl(value)}
            />
          </div>

          {customFields.length > 0 && (
            <div className="px-5 py-4 space-y-3 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("toolbar.customFields")}
              </h3>
              {customFields.map((f) => (
                <Row key={f.id} label={f.name}>
                  <div className="min-w-0 flex-1 sm:max-w-[280px]">
                    <CustomFieldInput
                      definition={f}
                      value={fieldValues[f.id]}
                      onChange={(v) =>
                        setFieldValues((prev) => ({ ...prev, [f.id]: v }))
                      }
                      users={users}
                    />
                  </div>
                </Row>
              ))}
            </div>
          )}

          <div className="px-5 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {t("task.subtasks")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("task.addSubtasksLater")}
            </p>
          </div>
        </div>

        <div className="grid gap-2 border-t border-border bg-card/50 px-4 py-3 sm:flex sm:items-center sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("task.createTask")}
          </button>
        </div>
      </form>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
