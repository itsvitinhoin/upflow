-- The sidebar schema includes this field, but the first navigation migration
-- only added it to folders and projects. Add it without changing visibility
-- for any existing space.
ALTER TABLE "Space" ADD COLUMN IF NOT EXISTS "sidebar_hidden" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Space_workspace_id_sidebar_hidden_idx"
  ON "Space"("workspace_id", "sidebar_hidden");
