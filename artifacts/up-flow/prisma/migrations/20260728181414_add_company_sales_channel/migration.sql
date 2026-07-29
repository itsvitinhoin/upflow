-- Keep legacy clients unclassified until a user explicitly selects a sales channel.
DO $$ BEGIN
  CREATE TYPE "ClientSalesChannel" AS ENUM ('WHOLESALE', 'RETAIL', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "sales_channel" "ClientSalesChannel";

CREATE INDEX IF NOT EXISTS "Company_workspace_id_sales_channel_created_at_id_idx"
  ON "Company"("workspace_id", "sales_channel", "created_at" DESC, "id" ASC);
