ALTER TYPE "TimeEntryStatus" ADD VALUE IF NOT EXISTS 'paused' BEFORE 'stopped';

ALTER TABLE "TimeEntry"
  ADD COLUMN IF NOT EXISTS "active_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paused_at" TIMESTAMP(3);

UPDATE "TimeEntry"
SET "active_started_at" = "started_at"
WHERE "status" = 'running'
  AND "active_started_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "TimeEntry_one_active_per_user_workspace_idx"
  ON "TimeEntry"("workspace_id", "user_id")
  WHERE "status" <> 'stopped';

DROP INDEX IF EXISTS "TimeEntry_one_running_per_user_workspace_idx";
