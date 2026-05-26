"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import CustomFieldInput from "@/components/projects/custom-field-input";
import TaskCoverImageControl from "@/components/projects/task-cover-image-control";
import type { CustomFieldDefinition, TaskAssignee } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultStatus?: "todo" | "in_progress" | "done";
  customFields: CustomFieldDefinition[];
  users: TaskAssignee[];
  onCreated: () => void;
}

const STATUS_OPTIONS = [
  { value: "todo", label: "To Do", dot: "bg-muted-foreground/60" },
  { value: "in_progress", label: "In Progress", dot: "bg-primary" },
  { value: "done", label: "Done", dot: "bg-upflow-success" },
] as const;

export default function CreateTaskPanel({
  open,
  onClose,
  projectId,
  defaultStatus = "todo",
  customFields,
  users,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"todo" | "in_progress" | "done">(defaultStatus);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setCoverImageUrl(null);
      setAssigneeId("");
      setFieldValues({});
    }
  }, [open, defaultStatus]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
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
          title: title.trim(),
          description: description || null,
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
        throw new Error(data.error || "Failed to create task");
      }

      onCreated();
      toast.success("Task created");
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
        className="fixed right-0 top-0 h-full w-full max-w-[520px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
            <ListTodo className="w-3.5 h-3.5" />
            New Task
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
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
                title="Click to cycle status"
              >
                <span className={cn("w-2 h-2 rounded-full", activeStatus.dot)} />
                {activeStatus.label}
              </button>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task name"
                autoFocus
                required
                className="flex-1 bg-transparent text-xl font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none py-1"
              />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add description..."
              className="w-full text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none resize-none border border-transparent hover:border-border focus:border-border rounded-md px-2 py-1.5 -mx-2"
            />
          </div>

          <div className="px-5 py-4 space-y-3 border-b border-border">
            <Row label="Assignee">
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="text-sm bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Due date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-sm bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Row>
            <Row label="Priority">
              <div className="flex gap-1">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-md border capitalize",
                      priority === p
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Row>
          </div>

          <div className="px-5 py-4 border-b border-border">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Board cover image
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
                Custom fields
              </h3>
              {customFields.map((f) => (
                <Row key={f.id} label={f.name}>
                  <div className="flex-1 max-w-[280px]">
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
              Subtasks
            </h3>
            <p className="text-xs text-muted-foreground">
              Add subtasks after creating the task from its detail view.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border bg-card/50 flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create task
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
