-- A shared department queue remains visible even when an earlier navigation
-- migration left one of its folder ancestors hidden. Restore only the paths
-- that contain affected shared queues; folders without sidebar-visible work
-- remain hidden.
WITH RECURSIVE queue_defaults (space_name, list_name) AS (
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
    queue_defaults.list_name
  FROM "Space" AS space
  INNER JOIN queue_defaults
    ON lower(btrim(space.name)) = lower(queue_defaults.space_name)
), department_folder_paths (id, parent_id, workspace_id, space_id) AS (
  SELECT
    folder.id,
    folder.parent_id,
    folder.workspace_id,
    folder.space_id
  FROM "Project" AS project
  INNER JOIN department_queues
    ON project."workspace_id" = department_queues.workspace_id
    AND project."space_id" = department_queues.space_id
    AND project."company_id" IS NULL
    AND lower(btrim(project.name)) = lower(department_queues.list_name)
  INNER JOIN "Folder" AS folder
    ON folder.id = project."folder_id"
    AND folder.workspace_id = department_queues.workspace_id
    AND folder.space_id = department_queues.space_id
  UNION
  SELECT
    parent.id,
    parent.parent_id,
    descendant.workspace_id,
    descendant.space_id
  FROM "Folder" AS parent
  INNER JOIN department_folder_paths AS descendant
    ON descendant.parent_id = parent.id
    AND parent.workspace_id = descendant.workspace_id
    AND parent.space_id = descendant.space_id
)
UPDATE "Folder" AS folder
SET "sidebar_hidden" = false
FROM department_folder_paths
WHERE folder.id = department_folder_paths.id
  AND folder.workspace_id = department_folder_paths.workspace_id
  AND folder.space_id = department_folder_paths.space_id
  AND folder."sidebar_hidden" = true;
