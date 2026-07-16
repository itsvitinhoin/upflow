-- The search endpoint uses case-insensitive substring matching. These GIN
-- indexes keep the existing ILIKE queries off sequential scans at pilot load.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Task_title_trgm_idx"
  ON "Task" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Task_description_trgm_idx"
  ON "Task" USING GIN ("description" gin_trgm_ops)
  WHERE "description" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Project_name_trgm_idx"
  ON "Project" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Project_description_trgm_idx"
  ON "Project" USING GIN ("description" gin_trgm_ops)
  WHERE "description" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Doc_title_trgm_idx"
  ON "Doc" USING GIN ("title" gin_trgm_ops);
