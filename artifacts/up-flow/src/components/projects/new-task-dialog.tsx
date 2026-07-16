"use client";

import TaskCreateSheet from "@/components/projects/task-create-sheet";
import { DEFAULT_TASK_TEMPLATE_ID, type TaskTemplateId } from "@/lib/task-templates";
import type { Task } from "@/lib/types";

/**
 * Backward-compatible adapter for callers outside the main application.
 * Dashboard, Calendar, Spaces, and Projects import TaskCreateSheet directly.
 */
export default function NewTaskDialog({
  open,
  onClose,
  onCreated,
  projectId,
  defaultStatus = "todo",
  defaultTemplateId = DEFAULT_TASK_TEMPLATE_ID,
  defaultDueDate = "",
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (task?: Task) => void;
  projectId?: string;
  defaultStatus?: Task["status"];
  defaultTemplateId?: TaskTemplateId;
  defaultDueDate?: string;
}) {
  return (
    <TaskCreateSheet
      open={open}
      onClose={onClose}
      onCreated={onCreated}
      projectId={projectId}
      defaultStatus={defaultStatus}
      defaultTemplateId={defaultTemplateId}
      defaultDueDate={defaultDueDate}
    />
  );
}
