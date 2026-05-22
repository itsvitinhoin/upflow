ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "parent_id" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "ActivityEvent" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "commercial_status" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "contract_value" DOUBLE PRECISION;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "commission" DOUBLE PRECISION;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "CompanyContact" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "role" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanyNote" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Template" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "config" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Folder_parent_id_idx" ON "Folder"("parent_id");
CREATE INDEX IF NOT EXISTS "Folder_space_id_parent_id_idx" ON "Folder"("space_id", "parent_id");
CREATE INDEX IF NOT EXISTS "Project_company_id_idx" ON "Project"("company_id");
CREATE INDEX IF NOT EXISTS "Task_company_id_idx" ON "Task"("company_id");
CREATE INDEX IF NOT EXISTS "CalendarEvent_company_id_idx" ON "CalendarEvent"("company_id");
CREATE INDEX IF NOT EXISTS "ActivityEvent_company_id_idx" ON "ActivityEvent"("company_id");
CREATE INDEX IF NOT EXISTS "CompanyContact_workspace_id_idx" ON "CompanyContact"("workspace_id");
CREATE INDEX IF NOT EXISTS "CompanyContact_company_id_idx" ON "CompanyContact"("company_id");
CREATE INDEX IF NOT EXISTS "CompanyNote_workspace_id_idx" ON "CompanyNote"("workspace_id");
CREATE INDEX IF NOT EXISTS "CompanyNote_company_id_idx" ON "CompanyNote"("company_id");
CREATE INDEX IF NOT EXISTS "CompanyNote_author_id_idx" ON "CompanyNote"("author_id");
CREATE INDEX IF NOT EXISTS "Template_workspace_id_idx" ON "Template"("workspace_id");
CREATE INDEX IF NOT EXISTS "Template_type_idx" ON "Template"("type");

DO $$ BEGIN
  ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyNote" ADD CONSTRAINT "CompanyNote_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyNote" ADD CONSTRAINT "CompanyNote_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyNote" ADD CONSTRAINT "CompanyNote_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Template" ADD CONSTRAINT "Template_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Template" ADD CONSTRAINT "Template_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
