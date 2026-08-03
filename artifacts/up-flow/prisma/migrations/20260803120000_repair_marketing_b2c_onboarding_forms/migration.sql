-- Rebuild the form rows for legacy B2C form tasks created before the form
-- relation was enforced. Restrict candidates to clear B2C form work so
-- execution and kickoff tasks are never converted into form tasks.
WITH b2c_form_candidates AS (
  SELECT DISTINCT ON (item."onboarding_id")
    item."workspace_id",
    item."onboarding_id",
    item."id" AS "checklist_item_id",
    item."task_id",
    onboarding."company_id",
    task."project_id",
    CASE
      WHEN item."status" = 'complete' THEN 'complete'
      WHEN item."status" = 'in_progress' THEN 'in_progress'
      ELSE 'draft'
    END AS "status",
    item."completed_at",
    item."completed_by"
  FROM "OnboardingChecklistItem" AS item
  INNER JOIN "ClientOnboarding" AS onboarding ON onboarding."id" = item."onboarding_id"
  INNER JOIN "Task" AS task ON task."id" = item."task_id"
  INNER JOIN "Project" AS project ON project."id" = task."project_id"
  LEFT JOIN "Space" AS space ON space."id" = project."space_id"
  WHERE item."task_id" IS NOT NULL
    AND (
      lower(coalesce(item."department", '')) LIKE '%marketing b2c%'
      OR lower(coalesce(project."name", '')) LIKE '%marketing b2c%'
      OR lower(coalesce(space."name", '')) LIKE '%marketing b2c%'
    )
    AND lower(
      coalesce(item."department", '') || ' ' ||
      coalesce(item."title", '') || ' ' ||
      coalesce(task."title", '') || ' ' ||
      coalesce(task."description", '')
    ) LIKE '%form%'
    AND NOT (
      lower(
      coalesce(item."department", '') || ' ' ||
      coalesce(item."title", '') || ' ' ||
      coalesce(task."title", '') || ' ' ||
      coalesce(task."description", '')
      ) LIKE ANY (ARRAY['%meeting%', '%reuni%', '%schedule%', '%kickoff%', '%agenda%'])
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "MarketingB2COnboardingForm" AS form
      WHERE form."onboarding_id" = item."onboarding_id"
         OR form."checklist_item_id" = item."id"
         OR form."task_id" = item."task_id"
    )
  ORDER BY item."onboarding_id", item."sort_order", item."created_at", item."id"
)
INSERT INTO "MarketingB2COnboardingForm" (
  "id",
  "workspace_id",
  "onboarding_id",
  "checklist_item_id",
  "task_id",
  "company_id",
  "project_id",
  "values",
  "status",
  "completed_at",
  "completed_by"
)
SELECT
  gen_random_uuid()::text,
  candidate."workspace_id",
  candidate."onboarding_id",
  candidate."checklist_item_id",
  candidate."task_id",
  candidate."company_id",
  candidate."project_id",
  '{}'::jsonb,
  candidate."status",
  candidate."completed_at",
  candidate."completed_by"
FROM b2c_form_candidates AS candidate;
