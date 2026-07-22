-- Department onboarding work must be reachable from its owning Space.
UPDATE "Project"
SET "sidebar_hidden" = false
WHERE "kind" = 'onboarding'
  AND "sidebar_hidden" = true;

WITH RECURSIVE onboarding_folder_ids ("id") AS (
  SELECT DISTINCT "folder_id"
  FROM "Project"
  WHERE "kind" = 'onboarding'
    AND "folder_id" IS NOT NULL
  UNION
  SELECT parent."parent_id"
  FROM "Folder" AS parent
  INNER JOIN onboarding_folder_ids AS descendant ON descendant."id" = parent."id"
  WHERE parent."parent_id" IS NOT NULL
)
UPDATE "Folder" AS folder
SET "sidebar_hidden" = false
FROM onboarding_folder_ids
WHERE folder."id" = onboarding_folder_ids."id"
  AND folder."sidebar_hidden" = true;
