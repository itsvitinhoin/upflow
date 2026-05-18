-- Allow Notification rows to be scoped to a workspace event (e.g. a new
-- member joined) instead of always being tied to a specific task.

ALTER TYPE "NotificationType" ADD VALUE 'member_joined';

ALTER TABLE "Notification"
  ALTER COLUMN "task_id" DROP NOT NULL,
  ADD COLUMN "workspace_id" TEXT,
  ADD COLUMN "data" JSONB;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE;

CREATE INDEX "Notification_user_id_created_at_idx"
  ON "Notification"("user_id", "created_at");
