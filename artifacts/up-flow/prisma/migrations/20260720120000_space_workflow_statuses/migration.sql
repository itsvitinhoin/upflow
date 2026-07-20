ALTER TABLE "WorkflowStatus" ADD COLUMN IF NOT EXISTS "space_id" TEXT;

CREATE INDEX IF NOT EXISTS "WorkflowStatus_space_id_idx" ON "WorkflowStatus"("space_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WorkflowStatus_space_id_fkey'
  ) THEN
    ALTER TABLE "WorkflowStatus"
      ADD CONSTRAINT "WorkflowStatus_space_id_fkey"
      FOREIGN KEY ("space_id") REFERENCES "Space"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
