"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  X, Trash2, Send, Loader2, Plus, Check, ChevronDown, ChevronRight, CornerDownRight
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { Task, Comment, TaskAssignee } from "@/lib/types";

interface TaskDetailSheetProps {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
}

interface DetailTask extends Task {
  subtasks?: Task[];
  comments?: Comment[];
}

export default function TaskDetailSheet({ task, onClose, onUpdate }: TaskDetailSheetProps) {
  const [currentTask, setCurrentTask] = useState<DetailTask>(task);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<TaskAssignee[]>([]);
  const [saving, setSaving] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);

  useEffect(() => {
    loadTaskDetails();
    fetch("/api/users")
      .then((r) => r.json())
      .then((data: TaskAssignee[]) => setUsers(data))
      .catch(() => {});
  }, [task.id]);

  const loadTaskDetails = () => {
    fetch(`/api/tasks/${task.id}`)
      .then((r) => r.json())
      .then((data: DetailTask) => {
        setCurrentTask(data);
        setComments(data.comments ?? []);
      })
      .catch(() => {});
  };

  const update = async (patch: Partial<Task>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${currentTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as Task;
      setCurrentTask((prev) => ({ ...prev, ...updated }));
      toast.success("Updated");
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${currentTask.id}`, { method: "DELETE" });
    onUpdate();
    toast.success("Task deleted");
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
      toast.error("Failed to add comment");
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
      toast.error("Failed to add reply");
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
      const subtask = await res.json() as Task;
      setCurrentTask((prev) => ({
        ...prev,
        subtasks: [...(prev.subtasks ?? []), subtask],
      }));
      setNewSubtask("");
    } catch {
      toast.error("Failed to add subtask");
    } finally {
      setAddingSubtask(false);
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
      const updated = await res.json() as Task;
      setCurrentTask((prev) => ({
        ...prev,
        subtasks: (prev.subtasks ?? []).map((s) => (s.id === subtaskId ? updated : s)),
      }));
    } catch {
      toast.error("Failed to update subtask");
    }
  };

  const subtasks = currentTask.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.status === "done").length;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-border">
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Properties */}
          <div className="px-6 py-4 space-y-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24">Status</span>
              <select
                value={currentTask.status}
                onChange={(e) => update({ status: e.target.value as Task["status"] })}
                className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24">Priority</span>
              <select
                value={currentTask.priority}
                onChange={(e) => update({ priority: e.target.value as Task["priority"] })}
                className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24">Assignee</span>
              <select
                value={currentTask.assignee_id || ""}
                onChange={(e) => update({ assignee_id: e.target.value || null })}
                className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24">Due date</span>
              <input
                type="date"
                defaultValue={currentTask.due_date ? currentTask.due_date.split("T")[0] : ""}
                onBlur={(e) => update({ due_date: e.target.value || null })}
                className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Description */}
          <div className="px-6 py-4 border-b border-border">
            <label className="block text-sm font-medium text-foreground mb-2">Description</label>
            <textarea
              defaultValue={currentTask.description || ""}
              onBlur={(e) => {
                if (e.target.value !== (currentTask.description || "")) {
                  update({ description: e.target.value || null });
                }
              }}
              rows={3}
              placeholder="Add a description..."
              className="w-full text-sm border border-border bg-background rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Subtasks */}
          <div className="px-6 py-4 border-b border-border">
            <button
              onClick={() => setSubtasksExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-foreground mb-3 w-full"
            >
              {subtasksExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              Subtasks
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
                    </div>
                  ))}
                  {subtasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">No subtasks yet</p>
                  )}
                </div>

                <form onSubmit={addSubtask} className="flex gap-2">
                  <input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Add a subtask..."
                    className="flex-1 text-sm border border-border bg-background rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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

          {/* Comments */}
          <div className="px-6 py-4">
            <h3 className="text-sm font-medium text-foreground mb-4">
              Comments ({comments.length})
            </h3>
            <div className="space-y-4 mb-4">
              {comments.map((c) => (
                <div key={c.id}>
                  {/* Top-level comment */}
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
                        Reply
                      </button>
                    </div>
                  </div>

                  {/* Replies */}
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

                  {/* Reply input */}
                  {replyingTo === c.id && (
                    <div className="ml-10 mt-2 flex gap-2">
                      <CornerDownRight className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-2.5" />
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
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
                <p className="text-sm text-muted-foreground">No comments yet</p>
              )}
            </div>

            {/* New top-level comment */}
            <form onSubmit={addComment} className="flex gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
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
