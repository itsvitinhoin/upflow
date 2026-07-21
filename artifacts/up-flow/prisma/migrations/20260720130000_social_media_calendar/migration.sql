-- Social Media calendar plans. The guards make this safe to re-run in
-- controlled deployments that may have partially provisioned the list.
CREATE TABLE IF NOT EXISTS "SocialMediaContentPlan" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "monthly_post_target" INTEGER NOT NULL,
    "weekly_posting_frequency" INTEGER NOT NULL,
    "required_formats" JSONB,
    "social_manager_id" TEXT,
    "designer_id" TEXT,
    "moodboard_status" TEXT NOT NULL DEFAULT 'Not Started',
    "moodboard_task_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMediaContentPlan_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "project_id" TEXT;
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "month" TIMESTAMP(3);
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "monthly_post_target" INTEGER;
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "weekly_posting_frequency" INTEGER;
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "required_formats" JSONB;
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "social_manager_id" TEXT;
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "designer_id" TEXT;
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "moodboard_status" TEXT NOT NULL DEFAULT 'Not Started';
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "moodboard_task_id" TEXT;
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "SocialMediaContentPlan" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "social_media_plan_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SocialMediaContentPlan_project_id_company_id_month_key"
  ON "SocialMediaContentPlan"("project_id", "company_id", "month");
CREATE UNIQUE INDEX IF NOT EXISTS "SocialMediaContentPlan_moodboard_task_id_key"
  ON "SocialMediaContentPlan"("moodboard_task_id");
CREATE INDEX IF NOT EXISTS "SocialMediaContentPlan_project_id_month_idx"
  ON "SocialMediaContentPlan"("project_id", "month");
CREATE INDEX IF NOT EXISTS "SocialMediaContentPlan_company_id_month_idx"
  ON "SocialMediaContentPlan"("company_id", "month");
CREATE INDEX IF NOT EXISTS "SocialMediaContentPlan_social_manager_id_idx"
  ON "SocialMediaContentPlan"("social_manager_id");
CREATE INDEX IF NOT EXISTS "SocialMediaContentPlan_designer_id_idx"
  ON "SocialMediaContentPlan"("designer_id");
CREATE INDEX IF NOT EXISTS "Task_social_media_plan_id_idx"
  ON "Task"("social_media_plan_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SocialMediaContentPlan_project_id_fkey'
  ) THEN
    ALTER TABLE "SocialMediaContentPlan"
      ADD CONSTRAINT "SocialMediaContentPlan_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SocialMediaContentPlan_company_id_fkey'
  ) THEN
    ALTER TABLE "SocialMediaContentPlan"
      ADD CONSTRAINT "SocialMediaContentPlan_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SocialMediaContentPlan_social_manager_id_fkey'
  ) THEN
    ALTER TABLE "SocialMediaContentPlan"
      ADD CONSTRAINT "SocialMediaContentPlan_social_manager_id_fkey"
      FOREIGN KEY ("social_manager_id") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SocialMediaContentPlan_designer_id_fkey'
  ) THEN
    ALTER TABLE "SocialMediaContentPlan"
      ADD CONSTRAINT "SocialMediaContentPlan_designer_id_fkey"
      FOREIGN KEY ("designer_id") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SocialMediaContentPlan_moodboard_task_id_fkey'
  ) THEN
    ALTER TABLE "SocialMediaContentPlan"
      ADD CONSTRAINT "SocialMediaContentPlan_moodboard_task_id_fkey"
      FOREIGN KEY ("moodboard_task_id") REFERENCES "Task"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Task_social_media_plan_id_fkey'
  ) THEN
    ALTER TABLE "Task"
      ADD CONSTRAINT "Task_social_media_plan_id_fkey"
      FOREIGN KEY ("social_media_plan_id") REFERENCES "SocialMediaContentPlan"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
