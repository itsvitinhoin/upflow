"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  X, Trash2, Send, Loader2, Plus, Check, ChevronDown, ChevronRight, CornerDownRight
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import TaskCoverImageControl from "@/components/projects/task-cover-image-control";
import BrazilianDateInput from "@/components/ui/brazilian-date-input";
import type { Task, Comment, TaskAssignee, Subtask } from "@/lib/types";
import { logError } from "@/lib/log-error";
import { parseTaskBrief } from "@/lib/task-templates";

interface TaskDetailSheetProps {
  task: Task;
  users?: TaskAssignee[];
  onClose: () => void;
  onUpdate: () => void;
}

interface DetailTask extends Omit<Task, "subtasks"> {
  subtasks?: Subtask[];
  comments?: Comment[];
}

export default function TaskDetailSheet({ task, users: initialUsers, onClose, onUpdate }: TaskDetailSheetProps) {
  const { t } = useLanguage();
  const [currentTask, setCurrentTask] = useState<DetailTask>(task as DetailTask);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<TaskAssignee[]>(initialUsers ?? []);
  const [saving, setSaving] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);

  const loadTaskDetails = useCallback(() => {
    fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((data: DetailTask) => {
        setCurrentTask(data);
        setComments(data.comments ?? []);
        if (!initialUsers) {
          const workspaceId = data.project?.workspace_id;
          if (!workspaceId) {
            setUsers([]);
            return;
          }
          fetch(`/api/users?workspace_id=${workspaceId}&status=active`)
            .then((r) => r.json())
            .then((usersData: { items: TaskAssignee[] }) => setUsers(usersData.items ?? []))
            .catch((err) => logError("task-sheet:load-users", err));
        }
      })
      .catch((err) => logError("task-sheet:load-details", err, { id: task.id }));
  }, [initialUsers, task.id]);

  useEffect(() => {
    if (initialUsers) setUsers(initialUsers);
    loadTaskDetails();
  }, [initialUsers, loadTaskDetails]);

  // Single-flight queue: rapid blur events on different fields used to fire
  // overlapping PATCH requests whose responses could land out-of-order and
  // overwrite each other. We chain them so each patch waits for the previous
  // request to settle, and we always merge the server's authoritative
  // response back into state.
  const updateChain = useRef<Promise<void>>(Promise.resolve());

  const update = (patch: Partial<Task>) => {
    const next = updateChain.current.then(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/tasks/${currentTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`PATCH /api/tasks/${currentTask.id} → ${res.status}`);
        const updated = (await res.json()) as Task;
        setCurrentTask((prev) => ({ ...prev, ...updated }));
        toast.success(t("common.updated"));
      } catch (err) {
        logError("task-sheet:update", err, { id: currentTask.id, patch });
        toast.error(t("common.failedToUpdate"));
      } finally {
        setSaving(false);
      }
    });
    // Don't let a single rejection poison the chain — swallow here AFTER
    // logging above, so the next queued update still runs.
    updateChain.current = next.catch(() => {});
    return next;
  };

  const deleteTask = async () => {
    if (!confirm(t("task.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/tasks/${currentTask.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? t("task.failedDelete"));
      }
      onUpdate();
      toast.success(t("dashboard.taskDeleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("task.failedDelete"));
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, body: newComment }),
      });
      if (!res.ok) throw new Error();
      const comment = await res.json() as Comment;
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch {
      toast.error(t("task.failedAddComment"));
    } finally {
      setSubmitting(false);
    }
  };

  const addReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, body: replyText, parent_id: parentId }),
      });
      if (!res.ok) throw new Error();
      const reply = await res.json() as Comment;
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies ?? []), reply] }
            : c
        )
      );
      setReplyText("");
      setReplyingTo(null);
    } catch {
      toast.error(t("task.failedAddReply"));
    } finally {
      setSubmitting(false);
    }
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    setAddingSubtask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSubtask.trim(),
          project_id: currentTask.project_id,
          parent_id: currentTask.id,
          status: "todo",
          priority: "medium",
        }),
      });
      if (!res.ok) throw new Error();
      const subtask = await res.json() as Subtask;
      setCurrentTask((prev) => ({
        ...prev,
        subtasks: [...(prev.subtasks ?? []), subtask],
      }));
      setNewSubtask("");
    } catch {
      toast.error(t("task.failedAddSubtask"));
    } finally {
      setAddingSubtask(false);
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    if (!confirm(t("task.deleteSubtaskConfirm"))) return;
    try {
      const res = await fetch(`/api/tasks/${subtaskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCurrentTask((prev) => ({
        ...prev,
        subtasks: (prev.subtasks ?? []).filter((s) => s.id !== subtaskId),
      }));
    } catch {
      toast.error(t("task.failedDeleteSubtask"));
    }
  };

  const toggleSubtask = async (subtaskId: string, done: boolean) => {
    try {
      const res = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: done ? "done" : "todo" }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as Subtask;
      setCurrentTask((prev) => ({
        ...prev,
        subtasks: (prev.subtasks ?? []).map((s) => (s.id === subtaskId ? updated : s)),
      }));
    } catch {
      toast.error(t("task.failedUpdateSubtask"));
    }
  };

  const subtasks = currentTask.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.status === "done").length;
  const structuredBrief = parseTaskBrief(currentTask.description);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-dvh w-full flex-col overflow-hidden border-l border-border bg-background shadow-2xl sm:max-w-lg">
        <div className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div className="flex-1 min-w-0">
            <input
              defaultValue={currentTask.title}
              onBlur={(e) => {
                if (e.target.value !== currentTask.title) update({ title: e.target.value });
              }}
              className="text-lg font-semibold text-foreground bg-transparent w-full outline-none focus:ring-2 focus:ring-ring rounded px-1 -mx-1"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <button
              onClick={deleteTask}
              className="text-destructive hover:text-destructive/80 p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 border-b border-border px-4 py-4 sm:px-6">
            <div className="grid gap-2 sm:flex sm:items-center sm:gap-3">
              <span className="text-sm text-muted-foreground sm:w-24">{t("toolbar.status")}</span>
              <select
                value={currentTask.status}
                onChange={(e) => update({ status: e.target.value as Task["status"] })}
                className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="todo">{t("status.todo")}</option>
                <option value="in_progress">{t("status.inProgress")}</option>
                <option value="done">{t("status.done")}</option>
              </select>
            </div>
            <div className="grid gap-2 sm:flex sm:items-center sm:gap-3">
              <span className="text-sm text-muted-foreground sm:w-24">{t("toolbar.priority")}</span>
              <select
                value={currentTask.priority}
                onChange={(e) => update({ priority: e.target.value as Task["priority"] })}
                className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">{t("priority.low")}</option>
                <option value="medium">{t("priority.medium")}</option>
                <option value="high">{t("priority.high")}</option>
              </select>
            </div>
            <div className="grid gap-2 sm:flex sm:items-center sm:gap-3">
              <span className="text-sm text-muted-foreground sm:w-24">{t("toolbar.assignee")}</span>
              <select
                value={currentTask.assignee_id || ""}
                onChange={(e) => update({ assignee_id: e.target.value || null })}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("common.unassigned")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:flex sm:items-center sm:gap-3">
              <span className="text-sm text-muted-foreground sm:w-24">{t("toolbar.dueDate")}</span>
              <BrazilianDateInput
                value={currentTask.due_date ? currentTask.due_date.split("T")[0] : ""}
                onChange={() => {}}
                onCommit={(value) => update({ due_date: value || null })}
                className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="border-b border-border px-4 py-4 sm:px-6">
            <label className="block text-sm font-medium text-foreground mb-2">{t("task.descriptionBrief")}</label>
            {structuredBrief && (
              <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                    {structuredBrief.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("task.structuredBrief")}</span>
                </div>
                {structuredBrief.details.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {structuredBrief.details.slice(0, 8).map((item) => (
                      <div key={`${item.label}-${item.value}`} className="min-w-0 rounded-lg bg-black/10 px-2.5 py-2">
                        <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-0.5 break-words text-sm text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                {structuredBrief.checklist.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {structuredBrief.checklist.slice(0, 6).map((item) => (
                      <span key={item} className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <textarea
              defaultValue={currentTask.description || ""}
              onBlur={(e) => {
                if (e.target.value !== (currentTask.description || "")) {
                  update({ description: e.target.value || null });
                }
              }}
              rows={3}
              placeholder={t("task.descriptionPlaceholder")}
              className="w-full text-sm border border-border bg-background rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="border-b border-border px-4 py-4 sm:px-6">
            <label className="block text-sm font-medium text-foreground mb-2">{t("task.boardCoverImage")}</label>
            <TaskCoverImageControl
              value={currentTask.cover_image_url}
              disabled={saving}
              onChange={(cover_image_url) => update({ cover_image_url })}
            />
          </div>

          <div className="border-b border-border px-4 py-4 sm:px-6">
            <button
              onClick={() => setSubtasksExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-foreground mb-3 w-full"
            >
              {subtasksExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              {t("task.subtasks")}
              {subtasks.length > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({doneCount}/{subtasks.length})
                </span>
              )}
            </button>

            {subtasksExpanded && (
              <>
                <div className="space-y-2 mb-3">
                  {subtasks.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 group">
                      <button
                        onClick={() => toggleSubtask(s.id, s.status !== "done")}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                          s.status === "done"
                            ? "bg-primary border-primary"
                            : "border-border hover:border-primary"
                        )}
                      >
                        {s.status === "done" && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span
                        className={cn(
                          "text-sm flex-1",
                          s.status === "done"
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        )}
                      >
                        {s.title}
                      </span>
                      {s.assignee && (
                        <div
                          title={s.assignee.name}
                          className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0"
                        >
                          {getInitials(s.assignee.name)}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteSubtask(s.id)}
                        title={t("task.failedDeleteSubtask")}
                        aria-label={t("task.failedDeleteSubtask")}
                        className="text-muted-foreground/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {subtasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("task.noSubtasks")}</p>
                  )}
                </div>

                <form onSubmit={addSubtask} className="grid gap-2 sm:flex">
                  <input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder={t("task.addSubtask")}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="submit"
                    disabled={addingSubtask || !newSubtask.trim()}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                  >
                    {addingSubtask ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          <div className="px-4 py-4 sm:px-6">
            <h3 className="text-sm font-medium text-foreground mb-4">
              {t("task.comments")} ({comments.length})
            </h3>
            <div className="space-y-4 mb-4">
              {comments.map((c) => (
                <div key={c.id}>
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {getInitials(c.author?.name || "?")}
                    </div>
                    <div className="flex-1">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            {c.author?.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(c.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{c.body}</p>
                      </div>
                      <button
                        onClick={() =>
                          setReplyingTo((prev) => (prev === c.id ? null : c.id))
                        }
                        className="mt-1 ml-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        {t("task.reply")}
                      </button>
                    </div>
                  </div>

                  {(c.replies ?? []).length > 0 && (
                    <div className="ml-10 mt-2 space-y-2">
                      {(c.replies ?? []).map((r) => (
                        <div key={r.id} className="flex gap-2">
                          <CornerDownRight className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1.5" />
                          <div className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {getInitials(r.author?.name || "?")}
                          </div>
                          <div className="flex-1 bg-muted/70 rounded-lg p-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground">
                                {r.author?.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(r.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground">{r.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {replyingTo === c.id && (
                    <div className="ml-10 mt-2 flex gap-2">
                      <CornerDownRight className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-2.5" />
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={t("task.reply")}
                        autoFocus
                        className="flex-1 text-sm border border-border bg-background rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            addReply(c.id);
                          }
                          if (e.key === "Escape") setReplyingTo(null);
                        }}
                      />
                      <button
                        onClick={() => addReply(c.id)}
                        disabled={submitting || !replyText.trim()}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("task.comments")}: 0</p>
              )}
            </div>

            <form onSubmit={addComment} className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t("task.addComment")}
                className="flex-1 text-sm border border-border bg-background rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
