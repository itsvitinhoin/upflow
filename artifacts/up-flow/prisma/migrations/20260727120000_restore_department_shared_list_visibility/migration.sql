-- Restore the durable department queues that were either hidden by an older
-- visibility rollout or absent from existing workspaces. Client-scoped work is
-- deliberately excluded, and an existing queue can live in any folder.
WITH queue_defaults (space_name, list_name) AS (
  VALUES
    ('Marketing B2B', 'Campaigns'),
    ('Marketing B2B', 'LinkedIn & Outbound'),
    ('Marketing B2B', 'Landing Pages'),
    ('Marketing B2B', 'Reports'),
    ('Marketing B2C', 'Campaigns'),
    ('Marketing B2C', 'Content Calendar'),
    ('Marketing B2C', 'Ads'),
    ('Marketing B2C', 'Promotions'),
    ('Creative & Design', 'Design Queue'),
    ('Creative & Design', 'Creative Reviews'),
    ('Creative & Design', 'Brand Assets'),
    ('Creative & Design', 'Approvals'),
    ('Creative & Design', 'Social Media')
), department_queues AS (
  SELECT
    space.id AS space_id,
    space.workspace_id,
    space.owner_id,
    queue_defaults.list_name
  FROM "Space" AS space
  INNER JOIN queue_defaults
    ON lower(btrim(space.name)) = lower(queue_defaults.space_name)
)
UPDATE "Project" AS project
SET "sidebar_hidden" = false
FROM department_queues
WHERE project."workspace_id" = department_queues.workspace_id
  AND project."space_id" = department_queues.space_id
  AND project."company_id" IS NULL
  AND lower(btrim(project.name)) = lower(department_queues.list_name)
  AND project."sidebar_hidden" = true;

WITH queue_defaults (space_name, list_name) AS (
  VALUES
    ('Marketing B2B', 'Campaigns'),
    ('Marketing B2B', 'LinkedIn & Outbound'),
    ('Marketing B2B', 'Landing Pages'),
    ('Marketing B2B', 'Reports'),
    ('Marketing B2C', 'Campaigns'),
    ('Marketing B2C', 'Content Calendar'),
    ('Marketing B2C', 'Ads'),
    ('Marketing B2C', 'Promotions'),
    ('Creative & Design', 'Design Queue'),
    ('Creative & Design', 'Creative Reviews'),
    ('Creative & Design', 'Brand Assets'),
    ('Creative & Design', 'Approvals'),
    ('Creative & Design', 'Social Media')
), department_queues AS (
  SELECT
    space.id AS space_id,
    space.workspace_id,
    space.owner_id,
    queue_defaults.list_name
  FROM "Space" AS space
  INNER JOIN queue_defaults
    ON lower(btrim(space.name)) = lower(queue_defaults.space_name)
)
INSERT INTO "Project" (
  "id",
  "name",
  "status",
  "approval_status",
  "approval_stage",
  "workspace_id",
  "owner_id",
  "space_id",
  "kind",
  "onboarding_enabled",
  "sidebar_hidden"
)
SELECT
  gen_random_uuid()::text,
  department_queues.list_name,
  'active'::"ProjectStatus",
  'draft',
  'draft',
  department_queues.workspace_id,
  department_queues.owner_id,
  department_queues.space_id,
  'operational_queue'::"ProjectKind",
  false,
  false
FROM department_queues
WHERE NOT EXISTS (
  SELECT 1
  FROM "Project" AS project
  WHERE project."workspace_id" = department_queues.workspace_id
    AND project."space_id" = department_queues.space_id
    AND project."company_id" IS NULL
    AND lower(btrim(project.name)) = lower(department_queues.list_name)
);
