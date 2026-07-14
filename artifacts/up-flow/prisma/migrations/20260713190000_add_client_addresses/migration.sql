CREATE TABLE IF NOT EXISTS "ClientAddress" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "type" TEXT,
  "location_name" TEXT,
  "full_address" TEXT NOT NULL,
  "zip_code" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT,
  "maps_url" TEXT,
  "local_contact_name" TEXT,
  "local_contact_phone" TEXT,
  "department_usage" JSONB,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientAddress_workspace_id_idx" ON "ClientAddress"("workspace_id");
CREATE INDEX IF NOT EXISTS "ClientAddress_company_id_idx" ON "ClientAddress"("company_id");

ALTER TABLE "ClientAddress"
  ADD CONSTRAINT "ClientAddress_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientAddress"
  ADD CONSTRAINT "ClientAddress_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
