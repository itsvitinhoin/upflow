"use client";

import TaskCreateSheet from "@/components/projects/task-create-sheet";
import type { CustomFieldDefinition, TaskAssignee } from "@/lib/types";

/**
 * Backward-compatible adapter for extensions that still import the previous
 * project-only creator. All task creation now renders TaskCreateSheet.
 */
export default function CreateTaskPanel({
  open,
  onClose,
  projectId,
  defaultStatus = "todo",
  initialCustomFieldValues,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultStatus?: "todo" | "in_progress" | "done";
  initialCustomFieldValues?: Record<string, unknown>;
  customFields?: CustomFieldDefinition[];
  users?: TaskAssignee[];
  onCreated: () => void;
}) {
  return (
    <TaskCreateSheet
      open={open}
      onClose={onClose}
      projectId={projectId}
      defaultStatus={defaultStatus}
      initialCustomFieldValues={initialCustomFieldValues}
      onCreated={onCreated}
    />
  );
}
