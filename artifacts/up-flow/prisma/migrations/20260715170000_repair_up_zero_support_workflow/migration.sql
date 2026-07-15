UPDATE "MarketingB2BOnboardingForm" AS form
SET "project_id" = task."project_id"
FROM "Task" AS task
WHERE task."id" = form."task_id"
  AND form."project_id" <> task."project_id";

WITH candidates AS (
  SELECT DISTINCT ON (item."onboarding_id") item."id"
  FROM "OnboardingChecklistItem" AS item
  WHERE lower(btrim(item."title")) = 'configure up zero website'
    AND item."automation_key" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "OnboardingChecklistItem" AS keyed
      WHERE keyed."onboarding_id" = item."onboarding_id"
        AND keyed."automation_key" = 'up_zero_website_configuration'
    )
  ORDER BY item."onboarding_id", item."created_at", item."id"
)
UPDATE "OnboardingChecklistItem" AS item
SET "automation_key" = 'up_zero_website_configuration'
FROM candidates
WHERE item."id" = candidates."id";
