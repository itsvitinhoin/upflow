-- Some legacy department onboarding projects predate Project.kind. They are
-- client-scoped and still have a durable onboarding relationship, but were
-- missed by the first visibility repair which selected only kind='onboarding'.
UPDATE "Project" AS project
SET
  "sidebar_hidden" = false,
  "onboarding_enabled" = true,
  "kind" = 'onboarding'
WHERE project."folder_id" IS NOT NULL
  AND project."company_id" IS NOT NULL
  AND (
    project."kind" = 'onboarding'
    OR project."onboarding_enabled" = true
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

WITH RECURSIVE onboarding_folder_ids ("id") AS (
  SELECT DISTINCT "folder_id"
  FROM "Project"
  WHERE "folder_id" IS NOT NULL
    AND "company_id" IS NOT NULL
    AND ("kind" = 'onboarding' OR "onboarding_enabled" = true)
  UNION
  SELECT parent."parent_id"
  FROM "Folder" AS parent
  INNER JOIN onboarding_folder_ids AS descendant ON descendant."id" = parent."id"
  WHERE parent."parent_id" IS NOT NULL
)
UPDATE "Folder" AS folder
SET "sidebar_hidden" = false
FROM onboarding_folder_ids
WHERE folder."id" = onboarding_folder_ids."id";
