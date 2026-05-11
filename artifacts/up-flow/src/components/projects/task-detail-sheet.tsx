"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Trash2, Send, Calendar, User, Flag, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn, formatDate, getInitials, priorityColor, statusLabel } from "@/lib/utils";

interface TaskDetailSheetProps {
  task: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TaskDetailSheet({ task, onClose, onUpdate }: TaskDetailSheetProps) {
  const { data: session } = useSession();
  const [currentTask, setCurrentTask] = useState(task);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/comments?task_id=${task.id}`).then((r) => r.json()).then(setComments).catch(() => {});
    fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {});
  }, [task.id]);

  const update = async (patch: any) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${currentTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setCurrentTask(updated);
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
      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      toast.success("Comment added");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Sheet */}
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
            <button onClick={deleteTask} className="text-destructive hover:text-destructive/80 p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Properties */}
          <div className="px-6 py-4 space-y-4 border-b border-border">
            {/* Status */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24">Status</span>
              <select
                value={currentTask.status}
                onChange={(e) => update({ status: e.target.value })}
                className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-24">Priority</span>
              <select
                value={currentTask.priority}
                onChange={(e) => update({ priority: e.target.value })}
                className="text-sm border border-border bg-background rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Assignee */}
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

            {/* Due date */}
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
              rows={4}
              placeholder="Add a description..."
              className="w-full text-sm border border-border bg-background rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Comments */}
          <div className="px-6 py-4">
            <h3 className="text-sm font-medium text-foreground mb-4">Comments ({comments.length})</h3>
            <div className="space-y-3 mb-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(c.author?.name || "?")}
                  </div>
                  <div className="flex-1 bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-foreground">{c.author?.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground">{c.body}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              )}
            </div>

            {/* New comment */}
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
