ALTER TABLE "ClientOnboarding"
  ADD COLUMN IF NOT EXISTS "completion_override_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "completion_overridden_by" TEXT,
  ADD COLUMN IF NOT EXISTS "completion_overridden_at" TIMESTAMP(3);

ALTER TABLE "ClientOnboarding"
  DROP CONSTRAINT IF EXISTS "ClientOnboarding_project_id_fkey";

ALTER TABLE "ClientOnboarding"
  ALTER COLUMN "project_id" DROP NOT NULL;

ALTER TABLE "ClientOnboarding"
  ADD CONSTRAINT "ClientOnboarding_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
