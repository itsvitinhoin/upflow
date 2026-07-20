export function isSpaceWorkflowSchemaUnavailable(error: unknown): boolean {
  const details = error as { code?: unknown; message?: unknown; meta?: { column?: unknown } };
  if (details?.code !== "P2022") return false;
  const column = typeof details.meta?.column === "string" ? details.meta.column : "";
  const message = typeof details.message === "string" ? details.message : "";
  return column.includes("space_id") || message.includes("WorkflowStatus.space_id") || message.includes("space_id");
}

export const SPACE_WORKFLOW_SCHEMA_PENDING_MESSAGE =
  "Task status setup is still being deployed. Try again after the database migration finishes.";
