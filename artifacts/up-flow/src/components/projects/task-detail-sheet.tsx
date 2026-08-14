"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import {
  Activity, ArrowLeft, CalendarDays, Check, ChevronDown, ChevronRight, CircleDot,
  Clock3, CornerDownRight, ExternalLink, FolderKanban, ImageIcon, ListChecks,
  Loader2, MessageCircle, Paperclip, PanelLeft, Plus, Send, Trash2, X,
} from "lucide-react";
import { cn, formatDate, getInitials, relativeDueDateLabel } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import TaskCoverImageControl from "@/components/projects/task-cover-image-control";
import TaskAssigneePicker from "@/components/projects/task-assignee-picker";
import BrazilianDateInput from "@/components/ui/brazilian-date-input";
import type {
  Comment,
  CustomFieldDefinition,
  ActivityEvent,
  Subtask,
  Task,
  TaskAssignee,
  WorkflowStatus,
} from "@/lib/types";
import { logError } from "@/lib/log-error";
import { parseTaskBrief } from "@/lib/task-templates";
import { getTaskAssetPath, getTaskCoverDisplayUrl } from "@/lib/task-images";
import { appendVisibleMention } from "@/lib/comment-mentions";
import {
  resolveTaskBoardStatus,
  taskBoardStatusValue,
  taskStatusForTaskBoardOption,
} from "@/lib/task-board-status";
import {
  getCreativeBriefingRequester,
  isCreativeBriefingOwnershipDetailLabel,
  isCreativeBriefingType,
} from "@/lib/creative-briefing";
import { activityEventLabel } from "@/lib/activity-labels";

interface TaskDetailSheetProps {
  task: Task;
  users?: TaskAssignee[];
  customFields?: CustomFieldDefinition[];
  workflowStatuses?: WorkflowStatus[];
  spaceId?: string | null;
  canContribute?: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onChanged?: () => void;
}

interface DetailTask extends Omit<Task, "subtasks"> {
  subtasks?: Subtask[];
  comments?: Comment[];
}

type TaskWorkspaceTab = "briefing" | "subtasks" | "files" | "comments" | "activity";

export default function TaskDetailSheet({
  task,
  users: initialUsers,
  customFields = [],
  workflowStatuses = [],
  spaceId,
  canContribute = true,
  onClose,
  onUpdate,
  onChanged,
}: TaskDetailSheetProps) {
  const { language, t } = useLanguage();
  const [currentTask, setCurrentTask] = useState<DetailTask>(task as DetailTask);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [newCommentMentionIds, setNewCommentMentionIds] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyMentionIds, setReplyMentionIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<TaskAssignee[]>(initialUsers ?? []);
  const [saving, setSaving] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TaskWorkspaceTab>("briefing");
  const commentInputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const taskTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const loadActivity = useCallback(() => {
    setActivityLoading(true);
    fetch(`/api/activity?task_id=${encodeURIComponent(task.id)}&include_subtasks=true&limit=50`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Activity request failed");
        return (await response.json()) as { items?: ActivityEvent[] };
      })
      .then((data) => setActivityEvents(data.items ?? []))
      .catch((err) => logError("task-workspace:load-activity", err, { id: task.id }))
      .finally(() => setActivityLoading(false));
  }, [task.id]);
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
    loadActivity();
  }, [initialUsers, loadActivity, loadTaskDetails]);

  useEffect(() => {
    setActiveTab("briefing");
    setSubtasksExpanded(true);
    setReplyingTo(null);
  }, [task.id]);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-radix-popper-content-wrapper]")) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !workspaceRef.current) return;

      const focusables = Array.from(
        workspaceRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = originalBodyOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);
  // Single-flight queue: rapid blur events on different fields used to fire
  // overlapping PATCH requests whose responses could land out-of-order and
  // overwrite each other. We chain them so each patch waits for the previous
  // request to settle, and we always merge the server's authoritative
  // response back into state.
  const updateChain = useRef<Promise<void>>(Promise.resolve());

  const update = (patch: Partial<Task>) => {
    if (!canContribute) return Promise.resolve();
    const next = updateChain.current.then(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/tasks/${currentTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(await readTaskApiError(res, t("common.failedToUpdate")));
        const updated = (await res.json()) as Task;
        setCurrentTask((prev) => ({ ...prev, ...updated }));
        void loadActivity();
        toast.success(t("common.updated"));
      } catch (err) {
        logError("task-sheet:update", err, { id: currentTask.id, patch });
        toast.error(err instanceof Error ? err.message : t("common.failedToUpdate"));
      } finally {
        setSaving(false);
      }
    });
    // Don't let a single rejection poison the chain — swallow here AFTER
    // logging above, so the next queued update still runs.
    updateChain.current = next.catch(() => {});
    return next;
  };

  const boardStatus = useMemo(
    () =>
      resolveTaskBoardStatus({
        customFields,
        workflowStatuses,
        projectId: currentTask.project_id,
        spaceId,
      }),
    [currentTask.project_id, customFields, spaceId, workflowStatuses],
  );
  const selectedBoardStatusValue = boardStatus
    ? taskBoardStatusValue(
        boardStatus,
        currentTask.custom_field_values?.find(
          (fieldValue) => fieldValue.definition_id === boardStatus.field.id,
        )?.value,
        currentTask.status,
      )
    : "";

  const updateBoardStatus = (value: string) => {
    if (!boardStatus || !canContribute) return;
    const taskStatus = taskStatusForTaskBoardOption(boardStatus, value);
    const next = updateChain.current.then(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/tasks/${currentTask.id}/custom-fields`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            definition_id: boardStatus.field.id,
            value,
            ...(taskStatus ? { task_status: taskStatus } : {}),
          }),
        });
        if (!res.ok) throw new Error(await readTaskApiError(res, t("common.failedToUpdate")));
        setCurrentTask((previous) => ({
          ...previous,
          ...(taskStatus ? { status: taskStatus } : {}),
          custom_field_values: [
            ...(previous.custom_field_values ?? []).filter(
              (fieldValue) => fieldValue.definition_id !== boardStatus.field.id,
            ),
            { definition_id: boardStatus.field.id, value },
          ],
        }));
        onChanged?.();
        void loadActivity();
        toast.success(t("common.updated"));
      } catch (err) {
        logError("task-sheet:update-board-status", err, {
          id: currentTask.id,
          definition_id: boardStatus.field.id,
          value,
        });
        toast.error(err instanceof Error ? err.message : t("common.failedToUpdate"));
      } finally {
        setSaving(false);
      }
    });
    updateChain.current = next.catch(() => {});
    return next;
  };

  const deleteTask = async () => {
    if (!canContribute) return;
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
    if (!canContribute || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: task.id,
          body: newComment,
          mention_ids: newCommentMentionIds,
        }),
      });
      if (!res.ok) throw new Error(await readTaskApiError(res, t("task.failedAddComment")));
      const comment = await res.json() as Comment;
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      setNewCommentMentionIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("task.failedAddComment"));
    } finally {
      setSubmitting(false);
    }
  };

  const addReply = async (parentId: string) => {
    if (!canContribute || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: task.id,
          body: replyText,
          parent_id: parentId,
          mention_ids: replyMentionIds,
        }),
      });
      if (!res.ok) throw new Error(await readTaskApiError(res, t("task.failedAddReply")));
      const reply = await res.json() as Comment;
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies ?? []), reply] }
            : c
        )
      );
      setReplyText("");
      setReplyMentionIds([]);
      setReplyingTo(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("task.failedAddReply"));
    } finally {
      setSubmitting(false);
    }
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContribute || !newSubtask.trim()) return;
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
    if (!canContribute) return;
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
    if (!canContribute) return;
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
  const structuredBrief = parseTaskBrief(currentTask.description, language);
  const isCreativeBrief = Boolean(
    structuredBrief && isCreativeBriefingType(structuredBrief.type),
  );
  const creativeBriefRequester =
    isCreativeBrief && structuredBrief
      ? getCreativeBriefingRequester(structuredBrief.details)
      : null;
  const visibleBriefDetails =
    isCreativeBrief && structuredBrief
      ? structuredBrief.details.filter(
          (detail) => !isCreativeBriefingOwnershipDetailLabel(detail.label),
        )
      : (structuredBrief?.details ?? []);
  const coverImageUrl = getTaskCoverDisplayUrl(currentTask.cover_image_url);
  const taskProgress = subtasks.length > 0
    ? Math.round((doneCount / subtasks.length) * 100)
    : currentTask.status === "done"
      ? 100
      : currentTask.status === "in_progress"
        ? 50
        : 0;
  const incompleteSubtasks = subtasks.filter((subtask) => subtask.status !== "done");
  const taskReferences = visibleBriefDetails
    .map((detail) => {
      const assetPath = getTaskAssetPath(detail.value);
      const url = assetPath
        ? `/api/task-assets/${assetPath.split("/").map(encodeURIComponent).join("/")}`
        : isExternalReferenceUrl(detail.value)
          ? detail.value
          : null;
      return {
        ...detail,
        url,
        isImage: url ? isImageReferenceValue(detail.value) : false,
      };
    })
    .filter((detail): detail is { label: string; value: string; url: string; isImage: boolean } => Boolean(detail.url));
  const visualReferences = taskReferences.filter((reference) => reference.isImage);
  const briefingSummary =
    visibleBriefDetails.find((detail) => /^(description|descrição)$/i.test(detail.label))?.value ??
    (structuredBrief ? "" : currentTask.description ?? "");
  const taskTabs: Array<{ id: TaskWorkspaceTab; label: string; count?: number }> = [
    { id: "briefing", label: t("taskWorkspace.tab.briefing") },
    { id: "subtasks", label: t("taskWorkspace.tab.tasks"), count: subtasks.length },
    { id: "files", label: t("taskWorkspace.tab.files"), count: taskReferences.length + (coverImageUrl ? 1 : 0) },
    { id: "comments", label: t("task.comments"), count: comments.length },
    { id: "activity", label: t("activity.title"), count: activityEvents.length },
  ];
  const selectTaskTab = (tab: TaskWorkspaceTab) => setActiveTab(tab);
  const handleTaskTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? taskTabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + taskTabs.length) % taskTabs.length;
    selectTaskTab(taskTabs[nextIndex].id);
    requestAnimationFrame(() => taskTabRefs.current[nextIndex]?.focus());
  };
  const insertMention = (
    userId: string,
    setText: Dispatch<SetStateAction<string>>,
    setMentionIds: Dispatch<SetStateAction<string[]>>,
    inputRef: { current: HTMLInputElement | null },
  ) => {
    const user = users.find((item) => item.id === userId);
    if (!user) return;
    setText((prev) => appendVisibleMention(prev, user.name));
    setMentionIds((previous) =>
      previous.includes(user.id) ? previous : [...previous, user.id],
    );
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  };

  return (
    <div
      ref={workspaceRef}
      role="dialog"
      aria-modal="true"
      aria-label={currentTask.title}
      data-testid="task-detail-workspace"
      data-task-detail-hub="true"
      className="fixed inset-0 z-50 flex h-dvh overflow-hidden bg-[#07101f] text-foreground"
    >
      <aside
        aria-label={t("taskWorkspace.navigation")}
        className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#091426] px-4 py-5 2xl:flex"
      >
        <div className="flex items-center gap-2.5 px-1">
                              <img
            src="/assets/UP_LOGO_1778594851568.png"
            alt="UpFlow"
            className="h-8 w-8 rounded-lg object-contain"
          />
          <span className="text-base font-bold tracking-tight text-white">UP FLOW</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_rgba(64,88,255,0.24)] transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("taskWorkspace.backToProject")}
        </button>

        <nav className="mt-7 space-y-1" aria-label={t("taskWorkspace.context")}>
          {[
            { id: "briefing" as const, icon: PanelLeft, label: t("taskWorkspace.tab.briefing") },
            { id: "subtasks" as const, icon: ListChecks, label: t("taskWorkspace.tab.tasks") },
            { id: "comments" as const, icon: MessageCircle, label: t("task.comments") },
            { id: "activity" as const, icon: Activity, label: t("activity.title") },
          ].map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTaskTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  selected
                    ? "bg-primary/15 text-primary"
                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.id === "subtasks" && subtasks.length > 0 ? (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                    {doneCount}/{subtasks.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-white/10 pt-5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("taskWorkspace.projectContext")}
          </p>
          <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <FolderKanban className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-100">
                {currentTask.project?.name ?? t("task.newTask")}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-400">
                {t("activity.entity.task")}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
              {getInitials(currentTask.assignee?.name ?? t("common.unassigned"))}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                {currentTask.assignee?.name ?? t("common.unassigned")}
              </span>
              <span className="block truncate text-xs text-slate-400">{t("toolbar.assignee")}</span>
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0a1425]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label={t("taskWorkspace.backToProject")}
              className="rounded-md p-2 text-slate-300 transition hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 text-xs text-slate-400 sm:text-sm">
              <span className="font-medium text-slate-200">{currentTask.project?.name ?? t("task.newTask")}</span>
              <span className="mx-2 text-slate-600">/</span>
              <span>{currentTask.status === "done" ? t("status.done") : currentTask.status === "in_progress" ? t("status.inProgress") : t("status.todo")}</span>
              <span className="mx-2 text-slate-600">/</span>
              <span className="font-medium text-slate-100">{currentTask.title}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            {canContribute ? (
              <button
                type="button"
                onClick={deleteTask}
                aria-label={t("task.deleteConfirm")}
                className="rounded-lg p-2 text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={t("task.closeDetails")}
              className="rounded-lg p-2 text-slate-300 transition hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4 lg:p-5">
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <main
              data-testid="task-detail-main"
              className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1729] shadow-[0_22px_56px_rgba(0,0,0,0.24)]"
            >              <section className="border-b border-white/10 p-4 sm:p-5 lg:p-6">
                <div className="grid gap-5 lg:grid-cols-[164px_minmax(0,1fr)]">
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    {coverImageUrl ? (
                      <>
                              <img
                          src={coverImageUrl}
                          alt={t("taskCover.alt")}
                          className="h-40 w-full object-cover lg:h-full"
                        />
                        <button
                          type="button"
                          onClick={() => selectTaskTab("files")}
                          className="absolute bottom-2 right-2 rounded-md border border-white/20 bg-black/50 p-2 text-white backdrop-blur transition hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={t("taskWorkspace.manageCover")}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectTaskTab("files")}
                        className="flex h-40 w-full flex-col items-center justify-center gap-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-full"
                      >
                        <ImageIcon className="h-7 w-7" />
                        <span className="text-xs font-medium">{t("taskWorkspace.manageCover")}</span>
                      </button>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <select
                        value={boardStatus ? selectedBoardStatusValue : currentTask.status}
                        disabled={!canContribute}
                        onChange={(event) =>
                          boardStatus
                            ? updateBoardStatus(event.target.value)
                            : update({ status: event.target.value as Task["status"] })
                        }
                        className={cn(
                          "min-h-8 rounded-full border border-primary/25 bg-primary/15 px-3 text-xs font-semibold tracking-wide text-primary outline-none transition focus:ring-2 focus:ring-primary disabled:opacity-70",
                          currentTask.status === "done" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
                        )}
                        aria-label={t("toolbar.status")}
                      >
                        {boardStatus ? (
                          boardStatus.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.value}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="todo">{t("status.todo")}</option>
                            <option value="in_progress">{t("status.inProgress")}</option>
                            <option value="done">{t("status.done")}</option>
                          </>
                        )}
                      </select>
                      <select
                        value={currentTask.priority}
                        disabled={!canContribute}
                        onChange={(event) => update({ priority: event.target.value as Task["priority"] })}
                        className={cn(
                          "min-h-8 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 text-xs font-semibold tracking-wide text-amber-200 outline-none transition focus:ring-2 focus:ring-primary disabled:opacity-70",
                          currentTask.priority === "high" && "border-rose-400/25 bg-rose-400/10 text-rose-200",
                          currentTask.priority === "low" && "border-sky-400/25 bg-sky-400/10 text-sky-200",
                        )}
                        aria-label={t("toolbar.priority")}
                      >
                        <option value="low">{t("priority.low")}</option>
                        <option value="medium">{t("priority.medium")}</option>
                        <option value="high">{t("priority.high")}</option>
                      </select>
                    </div>

                    <input
                      id={`task-workspace-title-${currentTask.id}`}
                      aria-label={t("taskWorkspace.taskTitle")}
                      defaultValue={currentTask.title}
                      disabled={!canContribute}
                      onBlur={(event) => {
                        if (event.target.value !== currentTask.title) update({ title: event.target.value });
                      }}
                      className="mt-3 w-full rounded-lg bg-transparent px-0 py-1 text-2xl font-bold leading-tight tracking-tight text-white outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-primary sm:text-3xl"
                    />
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                      {briefingSummary || t("taskWorkspace.noBriefingSummary")}
                    </p>
                    {structuredBrief?.type ? (
                      <p className="mt-3 text-xs font-medium text-slate-400">#{structuredBrief.type}</p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                          {getInitials(currentTask.assignee?.name ?? t("common.unassigned"))}
                        </span>
                        {currentTask.assignee?.name ?? t("common.unassigned")}
                      </span>
                      <span className="h-4 w-px bg-white/10" />
                      <span>{t("toolbar.assignee")}</span>
                    </div>
                  </div>
                </div>

                <dl className="mt-5 grid overflow-hidden rounded-xl border border-white/10 bg-black/10 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="min-w-0 border-b border-white/10 p-3 sm:border-r xl:border-b-0">
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {t("toolbar.dueDate")}
                    </dt>
                    <dd className="mt-2 min-w-0">
                      <BrazilianDateInput
                        value={currentTask.due_date ? currentTask.due_date.split("T")[0] : ""}
                        disabled={!canContribute}
                        onChange={() => {}}
                        onCommit={(value) => update({ due_date: value || null })}
                        className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-slate-100 focus:ring-0"
                      />
                      {currentTask.due_date ? (
                        <p className="mt-1 text-xs text-rose-300">{relativeDueDateLabel(currentTask.due_date, language)}</p>
                      ) : null}
                    </dd>
                  </div>
                  <div className="min-w-0 border-b border-white/10 p-3 xl:border-b-0 xl:border-r">
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <FolderKanban className="h-3.5 w-3.5" />
                      {t("taskWorkspace.project")}
                    </dt>
                    <dd className="mt-2 truncate text-sm font-semibold text-slate-100">
                      {currentTask.project?.name ?? t("task.newTask")}
                    </dd>
                  </div>
                  <div className="min-w-0 border-b border-white/10 p-3 sm:border-r xl:border-b-0">
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {t("taskWorkspace.created")}
                    </dt>
                    <dd className="mt-2 truncate text-sm font-semibold text-slate-100">
                      {formatDate(currentTask.created_at, language)}
                    </dd>
                  </div>
                  <div className="min-w-0 p-3">
                    <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <CircleDot className="h-3.5 w-3.5" />
                      {t("taskWorkspace.identifier")}
                    </dt>
                    <dd className="mt-2 truncate font-mono text-sm font-semibold text-slate-100">
                      {currentTask.id.slice(0, 8)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 max-w-sm">
                  <TaskAssigneePicker
                    value={currentTask.assignee_id || ""}
                    users={users}
                    onChange={(value) => update({ assignee_id: value || null })}
                    disabled={saving || !canContribute}
                    label={t("toolbar.assignee")}
                    emptyLabel={t("common.unassigned")}
                    mode="update"
                    modal
                    selectClassName="border-white/10 bg-black/10 text-slate-100"
                  />
                </div>
              </section>

              {currentTask.onboarding_link ? (
                <section className="border-b border-white/10 bg-primary/[0.06] px-4 py-4 sm:px-5 lg:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("task.onboardingTask")}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">
                        {currentTask.onboarding_link.department}: {currentTask.onboarding_link.title}
                      </p>
                    </div>
                    <a
                      href={currentTask.onboarding_link.href}
                      className="rounded-lg border border-primary/30 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10"
                    >
                      {t("task.openClient")}
                    </a>
                  </div>
                </section>
              ) : null}
              <section className="sticky top-0 z-10 border-b border-white/10 bg-[#0b1729]/95 px-4 backdrop-blur sm:px-5 lg:px-6">
                <div className="overflow-x-auto">
                  <div role="tablist" aria-label={t("taskWorkspace.tablist")} className="flex min-w-max items-center gap-1">
                  {taskTabs.map((tab, index) => {
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        ref={(node) => {
                          taskTabRefs.current[index] = node;
                        }}
                        id={`task-tab-${tab.id}-${currentTask.id}`}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        aria-controls={`task-panel-${tab.id}-${currentTask.id}`}
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => selectTaskTab(tab.id)}
                        onKeyDown={(event) => handleTaskTabKeyDown(event, index)}
                        className={cn(
                          "relative min-h-12 whitespace-nowrap px-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isSelected ? "text-primary" : "text-slate-400 hover:text-slate-100",
                        )}
                      >
                        {tab.label}
                        {tab.id === "subtasks" && subtasks.length > 0 ? (
                          <span className="ml-1.5 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-300">
                            {subtasks.length}
                          </span>
                        ) : null}
                        {tab.id === "comments" && comments.length > 0 ? (
                          <span className="ml-1.5 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-300">
                            {comments.length}
                          </span>
                        ) : null}
                        {isSelected ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
                      </button>
                    );
                  })}
                </div>
                </div>
              </section>

              <section className="p-4 sm:p-5 lg:p-6">
                {activeTab === "briefing" ? (
                  <div
                    id={`task-panel-briefing-${currentTask.id}`}
                    role="tabpanel"
                    aria-labelledby={`task-tab-briefing-${currentTask.id}`}
                    className="space-y-7"
                  >
                    <section>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                            {structuredBrief?.type ?? t("task.descriptionBrief")}
                          </p>
                          <h2 className="mt-1 text-base font-semibold text-white">{t("taskWorkspace.summary")}</h2>
                        </div>
                        {structuredBrief ? (
                          <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            {t("task.structuredBrief")}
                          </span>
                        ) : null}
                      </div>

                      {isCreativeBrief ? (
                        <div className="mb-4 grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-2">
                          <BriefingOwnershipPerson
                            label={t("creativeBrief.requester")}
                            name={creativeBriefRequester ?? t("creativeBrief.requesterNotRecorded")}
                          />
                          <BriefingOwnershipPerson
                            label={t("creativeBrief.assignedDesigners")}
                            name={currentTask.assignee?.name ?? t("common.unassigned")}
                            email={currentTask.assignee?.email}
                          />
                        </div>
                      ) : null}

                      {visibleBriefDetails.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {visibleBriefDetails.slice(0, 24).map((detail) => (
                            <div
                              key={`${detail.label}-${detail.value}`}
                              className="min-w-0 rounded-xl border border-white/10 bg-[#091426]/70 px-3.5 py-3"
                            >
                              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {detail.label}
                              </p>
                              <p className="mt-1.5 break-words text-sm font-medium leading-5 text-slate-100">
                                {detail.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>

                    <section>
                      <label className="mb-2 block text-sm font-semibold text-slate-100" htmlFor={`task-description-${currentTask.id}`}>
                        {t("task.descriptionBrief")}
                      </label>
                      <textarea
                        id={`task-description-${currentTask.id}`}
                        defaultValue={currentTask.description || ""}
                        disabled={!canContribute}
                        onBlur={(event) => {
                          if (event.target.value !== (currentTask.description || "")) {
                            update({ description: event.target.value || null });
                          }
                        }}
                        rows={5}
                        placeholder={t("task.descriptionPlaceholder")}
                        className="w-full resize-y rounded-xl border border-white/10 bg-black/10 px-3.5 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70"
                      />
                    </section>

                    {visualReferences.length > 0 || coverImageUrl ? (
                      <section>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h2 className="text-base font-semibold text-white">{t("taskWorkspace.visualReferences")}</h2>
                          <button
                            type="button"
                            onClick={() => selectTaskTab("files")}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {t("taskWorkspace.referenceFiles")}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                          {coverImageUrl ? (
                            <img
                              src={coverImageUrl}
                              alt={t("taskCover.alt")}
                              className="aspect-[4/3] w-full rounded-xl border border-white/10 object-cover"
                            />
                          ) : null}
                          {visualReferences.slice(0, 5).map((reference) => (
                            <a
                              key={`${reference.label}-${reference.url}`}
                              href={reference.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <img
                                src={reference.url}
                                alt={reference.label}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                              />
                              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-8 text-xs font-medium text-white">
                                {reference.label}
                              </span>
                            </a>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {structuredBrief?.checklist.length ? (
                      <section className="grid gap-5 border-t border-white/10 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
                        <div>
                          <h2 className="text-base font-semibold text-white">{t("taskWorkspace.directives")}</h2>
                          <ul className="mt-3 space-y-2.5">
                            {structuredBrief.checklist.map((item) => (
                              <li key={item} className="flex gap-2.5 text-sm leading-5 text-slate-300">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-primary/15 bg-primary/[0.06] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{t("taskWorkspace.editBrief")}</p>
                          <p className="mt-2 text-sm leading-5 text-slate-300">{briefingSummary || t("taskWorkspace.noBriefingSummary")}</p>
                        </div>
                      </section>
                    ) : null}
                  </div>
                ) : null}

                {activeTab === "subtasks" ? (
                  <section
                    id={`task-panel-subtasks-${currentTask.id}`}
                    role="tabpanel"
                    aria-labelledby={`task-tab-subtasks-${currentTask.id}`}
                    className="space-y-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("taskWorkspace.progress")}</p>
                        <h2 className="mt-1 text-lg font-semibold text-white">{t("task.subtasks")}</h2>
                        <p className="mt-1 text-sm text-slate-400">{t("taskWorkspace.completedOf", { completed: doneCount, total: subtasks.length })}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSubtasksExpanded((value) => !value)}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {subtasksExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {t("task.subtasks")}
                      </button>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400 transition-[width] duration-300" style={{ width: `${taskProgress}%` }} />
                    </div>
                    {subtasksExpanded ? (
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#091426]/65">
                        <div className="divide-y divide-white/10">
                          {subtasks.map((subtask) => (
                            <div key={subtask.id} className="group flex items-center gap-3 px-4 py-3.5">
                              <button
                                type="button"
                                onClick={() => toggleSubtask(subtask.id, subtask.status !== "done")}
                                disabled={!canContribute}
                                aria-label={subtask.status === "done" ? t("status.todo") : t("status.done")}
                                className={cn(
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60",
                                  subtask.status === "done" ? "border-primary bg-primary text-primary-foreground" : "border-white/20 bg-black/10 text-transparent hover:border-primary",
                                )}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <span className={cn("min-w-0 flex-1 text-sm", subtask.status === "done" ? "text-slate-500 line-through" : "text-slate-100")}>
                                {subtask.title}
                              </span>
                              {subtask.assignee ? (
                                <span title={subtask.assignee.name} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                                  {getInitials(subtask.assignee.name)}
                                </span>
                              ) : null}
                              {canContribute ? (
                                <button
                                  type="button"
                                  onClick={() => deleteSubtask(subtask.id)}
                                  aria-label={t("task.failedDeleteSubtask")}
                                  className="rounded-md p-1.5 text-slate-500 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          ))}
                          {subtasks.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-400">{t("task.noSubtasks")}</p> : null}
                        </div>
                        {canContribute ? (
                          <form onSubmit={addSubtask} className="flex gap-2 border-t border-white/10 p-3">
                            <input
                              value={newSubtask}
                              onChange={(event) => setNewSubtask(event.target.value)}
                              placeholder={t("task.addSubtask")}
                              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <button
                              type="submit"
                              disabled={addingSubtask || !newSubtask.trim()}
                              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              aria-label={t("task.addSubtask")}
                            >
                              {addingSubtask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                ) : null}
                {activeTab === "files" ? (
                  <section
                    id={`task-panel-files-${currentTask.id}`}
                    role="tabpanel"
                    aria-labelledby={`task-tab-files-${currentTask.id}`}
                    className="space-y-6"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("taskWorkspace.referenceFiles")}</p>
                      <h2 className="mt-1 text-lg font-semibold text-white">{t("task.boardCoverImage")}</h2>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#091426]/65 p-4">
                      <TaskCoverImageControl
                        value={currentTask.cover_image_url}
                        projectId={currentTask.project_id}
                        taskId={currentTask.id}
                        disabled={saving || !canContribute}
                        onChange={(cover_image_url) => update({ cover_image_url })}
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{t("taskWorkspace.referenceFiles")}</h3>
                      {taskReferences.length > 0 ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {taskReferences.map((reference) => (
                            <a
                              key={`${reference.label}-${reference.url}`}
                              href={reference.url}
                              target="_blank"
                              rel="noreferrer"
                              className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-[#091426]/65 p-3 transition hover:border-primary/40 hover:bg-primary/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Paperclip className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-100">{reference.label}</span>
                                <span className="mt-0.5 block truncate text-xs text-slate-400">{reference.value}</span>
                              </span>
                              <ExternalLink className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-primary" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                          {t("taskWorkspace.noFiles")}
                        </p>
                      )}
                    </div>
                  </section>
                ) : null}
                {activeTab === "comments" ? (
                  <section
                    id={`task-panel-comments-${currentTask.id}`}
                    role="tabpanel"
                    aria-labelledby={`task-tab-comments-${currentTask.id}`}
                    className="space-y-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("task.comments")}</p>
                        <h2 className="mt-1 text-lg font-semibold text-white">{t("task.comments")} ({comments.length})</h2>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <article key={comment.id} className="rounded-xl border border-white/10 bg-[#091426]/65 p-4">
                          <div className="flex gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                              {getInitials(comment.author?.name || "?")}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span className="text-sm font-semibold text-slate-100">{comment.author?.name}</span>
                                <time className="text-xs text-slate-500">{formatDate(comment.created_at, language)}</time>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{displayCommentBody(comment.body)}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (canContribute) setReplyingTo((previous) => (previous === comment.id ? null : comment.id));
                                }}
                                disabled={!canContribute}
                                className="mt-3 text-xs font-semibold text-slate-400 transition hover:text-primary disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                {t("task.reply")}
                              </button>
                            </div>
                          </div>

                          {(comment.replies ?? []).length > 0 ? (
                            <div className="ml-5 mt-4 space-y-3 border-l border-white/10 pl-4 sm:ml-10">
                              {(comment.replies ?? []).map((reply) => (
                                <div key={reply.id} className="flex gap-2.5">
                                  <CornerDownRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-500" />
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[9px] font-bold text-slate-300">
                                    {getInitials(reply.author?.name || "?")}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                      <span className="text-xs font-semibold text-slate-200">{reply.author?.name}</span>
                                      <time className="text-[11px] text-slate-500">{formatDate(reply.created_at, language)}</time>
                                    </div>
                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-300">{displayCommentBody(reply.body)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {replyingTo === comment.id ? (
                            <div className="ml-5 mt-4 flex gap-2.5 border-l border-primary/30 pl-4 sm:ml-10">
                              <CornerDownRight className="mt-2.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-col gap-2 sm:flex-row">
                                  <MentionPicker
                                    users={users}
                                    onPick={(userId) => insertMention(userId, setReplyText, setReplyMentionIds, replyInputRef)}
                                  />
                                  <input
                                    ref={replyInputRef}
                                    value={replyText}
                                    disabled={!canContribute}
                                    onChange={(event) => setReplyText(event.target.value)}
                                    placeholder={t("task.reply")}
                                    autoFocus
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        addReply(comment.id);
                                      }
                                      if (event.key === "Escape") {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setReplyingTo(null);
                                      }
                                    }}
                                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setReplyingTo(null)}
                                    className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                  >
                                    {t("common.cancel")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => addReply(comment.id)}
                                    disabled={submitting || !replyText.trim()}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                  >
                                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                    {t("task.reply")}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      ))}
                      {comments.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">{t("taskWorkspace.noComments")}</p>
                      ) : null}
                    </div>

                    <form onSubmit={addComment} className="rounded-xl border border-white/10 bg-[#091426]/65 p-3 sm:p-4">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <MentionPicker
                          users={users}
                          onPick={(userId) => insertMention(userId, setNewComment, setNewCommentMentionIds, commentInputRef)}
                        />
                        <input
                          ref={commentInputRef}
                          value={newComment}
                          disabled={!canContribute}
                          onChange={(event) => setNewComment(event.target.value)}
                          placeholder={t("task.addCommentWithMentions", { action: t("task.addComment") })}
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="submit"
                          disabled={!canContribute || submitting || !newComment.trim()}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          <span className="sm:hidden">{t("task.addComment")}</span>
                        </button>
                      </div>
                    </form>
                  </section>
                ) : null}

                {activeTab === "activity" ? (
                  <section
                    id={`task-panel-activity-${currentTask.id}`}
                    role="tabpanel"
                    aria-labelledby={`task-tab-activity-${currentTask.id}`}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("activity.title")}</p>
                        <h2 className="mt-1 text-lg font-semibold text-white">{t("taskWorkspace.recentActivity")}</h2>
                      </div>
                      {activityLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                    </div>
                    {activityEvents.length > 0 ? (
                      <ol className="relative space-y-4 border-l border-white/10 pl-5">
                        {activityEvents.map((event) => {
                          const actorName = event.actor?.name ?? t("activity.system");
                          return (
                            <li key={event.id} className="relative min-w-0">
                              <span className="absolute -left-[1.82rem] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#0b1729] text-[9px] font-bold text-primary">
                                {getInitials(actorName)}
                              </span>
                              <p className="text-sm leading-5 text-slate-200">
                                <span className="font-semibold text-slate-100">{actorName}</span>{" "}
                                <span className="text-slate-400">{activityEventLabel(event.type, t)}</span>
                              </p>
                              <p className="mt-1 text-xs text-slate-500">{formatDate(event.created_at, language)}</p>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
                        {activityLoading ? t("common.loading") : t("activity.noMatchingAuditEvents")}
                      </p>
                    )}
                  </section>
                ) : null}
              </section>
            </main>

            <aside
              data-testid="task-detail-activity"
              className="hidden min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1729] p-3 shadow-[0_22px_56px_rgba(0,0,0,0.24)] xl:flex"
            >
              <section className="rounded-xl border border-white/10 bg-[#091426]/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-white">{t("taskWorkspace.progress")}</h2>
                    <p className="mt-1 text-xs text-slate-400">{t("taskWorkspace.completedOf", { completed: doneCount, total: subtasks.length })}</p>
                  </div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-primary/35 bg-primary/10 text-xs font-bold text-primary" style={{ background: `conic-gradient(#4f6cff ${taskProgress}%, rgba(255,255,255,0.06) ${taskProgress}% 100%)` }}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0b1729] text-[10px] text-slate-100">{taskProgress}%</span>
                  </span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-sky-400 transition-[width] duration-300" style={{ width: `${taskProgress}%` }} />
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-[#091426]/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">{t("taskWorkspace.quickChecklist")}</h2>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                    {doneCount}/{subtasks.length}
                  </span>
                </div>
                {subtasks.length > 0 ? (
                  <ul className="mt-3 space-y-2.5">
                    {subtasks.slice(0, 5).map((subtask) => (
                      <li key={subtask.id} className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSubtask(subtask.id, subtask.status !== "done")}
                          disabled={!canContribute}
                          aria-label={subtask.status === "done" ? t("status.todo") : t("status.done")}
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60",
                            subtask.status === "done" ? "border-primary bg-primary text-primary-foreground" : "border-white/20 text-transparent hover:border-primary",
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <span className={cn("text-sm leading-5", subtask.status === "done" ? "text-slate-500 line-through" : "text-slate-200")}>
                          {subtask.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">{t("task.noSubtasks")}</p>
                )}
                <button
                  type="button"
                  onClick={() => selectTaskTab("subtasks")}
                  className="mt-4 text-xs font-semibold text-primary transition hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("taskWorkspace.viewTasks")}
                </button>
              </section>

              <section className="rounded-xl border border-white/10 bg-[#091426]/70 p-4">
                <h2 className="text-sm font-semibold text-white">{t("taskWorkspace.nextSteps")}</h2>
                {incompleteSubtasks.length > 0 ? (
                  <ul className="mt-3 divide-y divide-white/[0.07]">
                    {incompleteSubtasks.slice(0, 3).map((subtask) => (
                      <li key={subtask.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-slate-400">
                          {subtask.assignee ? getInitials(subtask.assignee.name) : <ChevronRight className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{subtask.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">{t("taskWorkspace.noNextSteps")}</p>
                )}
              </section>

              <section className="rounded-xl border border-white/10 bg-[#091426]/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">{t("taskWorkspace.recentActivity")}</h2>
                  {activityLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
                </div>
                {activityEvents.length > 0 ? (
                  <ol className="mt-3 space-y-3">
                    {activityEvents.slice(0, 4).map((event) => {
                      const actorName = event.actor?.name ?? t("activity.system");
                      return (
                        <li key={event.id} className="flex gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[9px] font-bold text-primary">
                            {getInitials(actorName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs leading-5 text-slate-300">
                              <strong className="font-semibold text-slate-100">{actorName}</strong>{" "}{activityEventLabel(event.type, t)}
                            </span>
                            <span className="block text-[11px] text-slate-500">{formatDate(event.created_at, language)}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">{activityLoading ? t("common.loading") : t("activity.noMatchingAuditEvents")}</p>
                )}
                <button
                  type="button"
                  onClick={() => selectTaskTab("activity")}
                  className="mt-4 text-xs font-semibold text-primary transition hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("taskWorkspace.viewAllActivity")}
                </button>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}


async function readTaskApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function displayCommentBody(body: string) {
  return body.replace(/@\[([^\]]+)\]\([0-9a-fA-F-]{36}\)/g, "@$1");
}

function isExternalReferenceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isImageReferenceValue(value: string) {
  const candidate = getTaskAssetPath(value) ?? value;
  return /\.(avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(candidate);
}
function BriefingOwnershipPerson({
  label,
  name,
  email,
}: {
  label: string;
  name: string;
  email?: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
          {getInitials(name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {name}
          </span>
          {email ? (
            <span className="block truncate text-xs text-muted-foreground">
              {email}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function MentionPicker({
  users,
  onPick,
}: {
  users: TaskAssignee[];
  onPick: (userId: string) => void;
}) {
  const { t } = useLanguage();
  if (users.length === 0) return null;
  return (
    <select
      value=""
      onChange={(event) => {
        if (event.target.value) onPick(event.target.value);
      }}
      className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label={t("task.mentionTeammate")}
    >
      <option value="">@ {t("task.mention")}</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          @{user.name}
        </option>
      ))}
    </select>
  );
}
