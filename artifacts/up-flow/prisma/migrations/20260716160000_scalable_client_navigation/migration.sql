-- Keep generated client onboarding work out of the default navigation tree.
ALTER TABLE "Folder" ADD COLUMN "sidebar_hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "sidebar_hidden" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SidebarClientPin" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SidebarClientPin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SidebarClientPin_workspace_id_user_id_company_id_key"
  ON "SidebarClientPin"("workspace_id", "user_id", "company_id");
CREATE INDEX "SidebarClientPin_workspace_id_user_id_position_idx"
  ON "SidebarClientPin"("workspace_id", "user_id", "position");
CREATE INDEX "SidebarClientPin_company_id_idx" ON "SidebarClientPin"("company_id");
CREATE INDEX "Folder_workspace_id_sidebar_hidden_idx" ON "Folder"("workspace_id", "sidebar_hidden");
CREATE INDEX "Project_workspace_id_sidebar_hidden_created_at_idx"
  ON "Project"("workspace_id", "sidebar_hidden", "created_at");

ALTER TABLE "SidebarClientPin"
  ADD CONSTRAINT "SidebarClientPin_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SidebarClientPin"
  ADD CONSTRAINT "SidebarClientPin_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SidebarClientPin"
  ADD CONSTRAINT "SidebarClientPin_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A project is generated onboarding work only when it is client-scoped, nested
-- in a folder, and linked to an onboarding form, enabled workflow, or checklist task.
UPDATE "Project" AS project
SET "sidebar_hidden" = true
WHERE project."company_id" IS NOT NULL
  AND project."folder_id" IS NOT NULL
  AND (
    project."onboarding_enabled" = true
    OR EXISTS (
      SELECT 1
      FROM "MarketingB2BOnboardingForm" AS form
      WHERE form."project_id" = project."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "MarketingB2COnboardingForm" AS form
      WHERE form."project_id" = project."id"
    )
    OR EXISTS (
      SELECT 1
      FROM "Task" AS task
      INNER JOIN "OnboardingChecklistItem" AS item ON item."task_id" = task."id"
      INNER JOIN "ClientOnboarding" AS onboarding ON onboarding."id" = item."onboarding_id"
      WHERE task."project_id" = project."id"
        AND onboarding."company_id" = project."company_id"
    )
  );

-- Hide a client folder only when all of its direct work is generated onboarding work.
UPDATE "Folder" AS folder
SET "sidebar_hidden" = true
WHERE EXISTS (
    SELECT 1
    FROM "Project" AS project
    WHERE project."folder_id" = folder."id"
      AND project."sidebar_hidden" = true
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Project" AS project
    WHERE project."folder_id" = folder."id"
      AND project."sidebar_hidden" = false
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Folder" AS child
    WHERE child."parent_id" = folder."id"
      AND child."sidebar_hidden" = false
  );

-- Hide a generated onboarding root only when it contains no visible manual work.
UPDATE "Folder" AS folder
SET "sidebar_hidden" = true
WHERE EXISTS (
    SELECT 1
    FROM "Folder" AS child
    WHERE child."parent_id" = folder."id"
      AND child."sidebar_hidden" = true
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Folder" AS child
    WHERE child."parent_id" = folder."id"
      AND child."sidebar_hidden" = false
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Project" AS project
    WHERE project."folder_id" = folder."id"
      AND project."sidebar_hidden" = false
  );
