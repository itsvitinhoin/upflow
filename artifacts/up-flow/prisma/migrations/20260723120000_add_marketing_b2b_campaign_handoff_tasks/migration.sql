-- Preserve manually created campaign-start tasks before adding missing ones.
-- Only Marketing B2B workflows receive this step; Vesti and UP Zero can also
-- appear in Marketing B2C onboarding and must not trigger the Finance handoff.
WITH matching_campaign_items AS (
  SELECT DISTINCT ON (item."onboarding_id", seed."automation_key")
    item."id",
    seed."automation_key"
  FROM "OnboardingChecklistItem" AS item
  INNER JOIN "Task" AS task ON task."id" = item."task_id"
  INNER JOIN "Project" AS project ON project."id" = task."project_id"
  LEFT JOIN "Space" AS space ON space."id" = project."space_id"
  INNER JOIN "ClientOnboarding" AS onboarding ON onboarding."id" = item."onboarding_id"
  CROSS JOIN (
    VALUES
      ('Vesti: Iniciar Campanha', 'marketing_b2b_vesti_campaign_start'),
      ('UP Zero: Iniciar Campanha', 'marketing_b2b_up_zero_campaign_start')
  ) AS seed("title", "automation_key")
  WHERE onboarding."status" <> 'onboarding_complete'
    AND lower(btrim(item."title")) = lower(seed."title")
    AND item."automation_key" IS NULL
    AND (
      lower(coalesce(space."name", '')) LIKE '%marketing b2b%'
      OR EXISTS (
        SELECT 1
        FROM "MarketingB2BOnboardingForm" AS form
        WHERE form."onboarding_id" = onboarding."id"
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "OnboardingChecklistItem" AS keyed
      WHERE keyed."onboarding_id" = item."onboarding_id"
        AND keyed."automation_key" = seed."automation_key"
    )
  ORDER BY item."onboarding_id", seed."automation_key", item."created_at", item."id"
)
UPDATE "OnboardingChecklistItem" AS item
SET "automation_key" = matching_campaign_items."automation_key"
FROM matching_campaign_items
WHERE item."id" = matching_campaign_items."id";

WITH workflow_sources AS (
  SELECT
    onboarding."id" AS "onboarding_id",
    onboarding."workspace_id",
    onboarding."company_id",
    onboarding."created_by",
    seed."service_name",
    seed."automation_key",
    seed."task_title",
    seed."department",
    seed."notes",
    source."project_id",
    COALESCE(source."owner_id", source."assignee_id", source."project_owner_id", onboarding."created_by") AS "owner_id"
  FROM "ClientOnboarding" AS onboarding
  CROSS JOIN (
    VALUES
      (
        'Vesti',
        'marketing_b2b_vesti_campaign_start',
        'Vesti: Iniciar Campanha',
        'Vesti Workflow',
        'Iniciar a campanha do cliente. Ao concluir, o Financeiro recebe automaticamente o aviso de início dos serviços.'
      ),
      (
        'UP Zero',
        'marketing_b2b_up_zero_campaign_start',
        'UP Zero: Iniciar Campanha',
        'UP Zero Workflow',
        'Iniciar a campanha do cliente. Ao concluir, o Financeiro recebe automaticamente o aviso de início dos serviços.'
      )
  ) AS seed("service_name", "automation_key", "task_title", "department", "notes")
  INNER JOIN LATERAL (
    SELECT
      item."owner_id",
      task."assignee_id",
      task."project_id",
      project."owner_id" AS "project_owner_id",
      space."name" AS "space_name"
    FROM "OnboardingChecklistItem" AS item
    INNER JOIN "Task" AS task ON task."id" = item."task_id"
    INNER JOIN "Project" AS project ON project."id" = task."project_id"
    LEFT JOIN "Space" AS space ON space."id" = project."space_id"
    WHERE item."onboarding_id" = onboarding."id"
      AND lower(item."title") LIKE lower(seed."service_name" || ': %')
    ORDER BY item."sort_order", item."created_at", item."id"
    LIMIT 1
  ) AS source ON TRUE
  WHERE onboarding."status" <> 'onboarding_complete'
    AND (
      lower(coalesce(source."space_name", '')) LIKE '%marketing b2b%'
      OR EXISTS (
        SELECT 1
        FROM "MarketingB2BOnboardingForm" AS form
        WHERE form."onboarding_id" = onboarding."id"
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "OnboardingChecklistItem" AS existing
      WHERE existing."onboarding_id" = onboarding."id"
        AND existing."automation_key" = seed."automation_key"
    )
), candidates AS (
  SELECT
    gen_random_uuid()::text AS "task_id",
    gen_random_uuid()::text AS "item_id",
    workflow_sources.*,
    (
      COALESCE(
        (SELECT MAX(task."position") FROM "Task" AS task WHERE task."project_id" = workflow_sources."project_id"),
        -1
      ) + ROW_NUMBER() OVER (
        PARTITION BY workflow_sources."project_id"
        ORDER BY workflow_sources."onboarding_id", workflow_sources."automation_key"
      )
    )::integer AS "task_position",
    (
      COALESCE(
        (SELECT MAX(item."sort_order") FROM "OnboardingChecklistItem" AS item WHERE item."onboarding_id" = workflow_sources."onboarding_id"),
        -1
      ) + ROW_NUMBER() OVER (
        PARTITION BY workflow_sources."onboarding_id"
        ORDER BY workflow_sources."automation_key"
      )
    )::integer AS "sort_order"
  FROM workflow_sources
), inserted_tasks AS (
  INSERT INTO "Task" (
    "id",
    "title",
    "description",
    "status",
    "priority",
    "project_id",
    "assignee_id",
    "company_id",
    "position"
  )
  SELECT
    candidate."task_id",
    candidate."task_title",
    candidate."notes" || E'\n\nConcluir esta tarefa atualiza automaticamente o checklist e o progresso do onboarding.',
    'todo'::"TaskStatus",
    'high'::"TaskPriority",
    candidate."project_id",
    candidate."owner_id",
    candidate."company_id",
    candidate."task_position"
  FROM candidates AS candidate
  RETURNING "id"
)
INSERT INTO "OnboardingChecklistItem" (
  "id",
  "onboarding_id",
  "workspace_id",
  "task_id",
  "automation_key",
  "department",
  "title",
  "owner_id",
  "notes",
  "sort_order"
)
SELECT
  candidate."item_id",
  candidate."onboarding_id",
  candidate."workspace_id",
  candidate."task_id",
  candidate."automation_key",
  candidate."department",
  candidate."task_title",
  candidate."owner_id",
  candidate."notes",
  candidate."sort_order"
FROM candidates AS candidate
INNER JOIN inserted_tasks AS task ON task."id" = candidate."task_id"
ON CONFLICT ("onboarding_id", "automation_key") DO NOTHING;
