WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "workspace_id", "user_id"
      ORDER BY "started_at" DESC, "id" DESC
    ) AS rn
  FROM "TimeEntry"
  WHERE "status" = 'running'
)
UPDATE "TimeEntry" AS te
SET
  "status" = 'stopped',
  "stopped_at" = now(),
  "duration_seconds" = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - te."started_at")))::integer)
FROM ranked
WHERE te."id" = ranked."id"
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "TimeEntry_one_running_per_user_workspace_idx"
  ON "TimeEntry"("workspace_id", "user_id")
  WHERE "status" = 'running';
