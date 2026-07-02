CREATE TABLE IF NOT EXISTS "MarketingB2COnboardingForm" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "onboarding_id" TEXT NOT NULL,
  "checklist_item_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "values" JSONB,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "completed_at" TIMESTAMP(3),
  "completed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingB2COnboardingForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingB2COnboardingForm_checklist_item_id_key" ON "MarketingB2COnboardingForm"("checklist_item_id");
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingB2COnboardingForm_task_id_key" ON "MarketingB2COnboardingForm"("task_id");
CREATE INDEX IF NOT EXISTS "MarketingB2COnboardingForm_workspace_id_idx" ON "MarketingB2COnboardingForm"("workspace_id");
CREATE INDEX IF NOT EXISTS "MarketingB2COnboardingForm_onboarding_id_idx" ON "MarketingB2COnboardingForm"("onboarding_id");
CREATE INDEX IF NOT EXISTS "MarketingB2COnboardingForm_company_id_idx" ON "MarketingB2COnboardingForm"("company_id");
CREATE INDEX IF NOT EXISTS "MarketingB2COnboardingForm_project_id_idx" ON "MarketingB2COnboardingForm"("project_id");
CREATE INDEX IF NOT EXISTS "MarketingB2COnboardingForm_completed_by_idx" ON "MarketingB2COnboardingForm"("completed_by");
CREATE INDEX IF NOT EXISTS "MarketingB2COnboardingForm_status_idx" ON "MarketingB2COnboardingForm"("status");

ALTER TABLE "MarketingB2COnboardingForm"
  ADD CONSTRAINT "MarketingB2COnboardingForm_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingB2COnboardingForm"
  ADD CONSTRAINT "MarketingB2COnboardingForm_onboarding_id_fkey"
  FOREIGN KEY ("onboarding_id") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingB2COnboardingForm"
  ADD CONSTRAINT "MarketingB2COnboardingForm_checklist_item_id_fkey"
  FOREIGN KEY ("checklist_item_id") REFERENCES "OnboardingChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingB2COnboardingForm"
  ADD CONSTRAINT "MarketingB2COnboardingForm_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingB2COnboardingForm"
  ADD CONSTRAINT "MarketingB2COnboardingForm_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingB2COnboardingForm"
  ADD CONSTRAINT "MarketingB2COnboardingForm_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingB2COnboardingForm"
  ADD CONSTRAINT "MarketingB2COnboardingForm_completed_by_fkey"
  FOREIGN KEY ("completed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
