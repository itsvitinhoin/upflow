ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "legal_name" TEXT,
  ADD COLUMN IF NOT EXISTS "cnpj" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_email" TEXT,
  ADD COLUMN IF NOT EXISTS "main_contact_email" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsapp" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "payment_terms" TEXT,
  ADD COLUMN IF NOT EXISTS "contract_start_date" TIMESTAMP(3);

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "onboarding_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "closing_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboarding_start_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "responsible_salesperson_id" TEXT,
  ADD COLUMN IF NOT EXISTS "initial_notes" TEXT;

CREATE TABLE IF NOT EXISTS "ClientOnboarding" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_commercial_setup',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "closing_date" TIMESTAMP(3),
  "expected_start_date" TIMESTAMP(3),
  "responsible_salesperson_id" TEXT,
  "initial_notes" TEXT,
  "contracted_services" JSONB,
  "completed_at" TIMESTAMP(3),
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OnboardingChecklistItem" (
  "id" TEXT NOT NULL,
  "onboarding_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "task_id" TEXT,
  "department" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "owner_id" TEXT,
  "due_date" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "completed_by" TEXT,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OnboardingServiceAssignment" (
  "id" TEXT NOT NULL,
  "onboarding_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "leader_id" TEXT,
  "department_id" TEXT,
  "department_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingServiceAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OnboardingMeeting" (
  "id" TEXT NOT NULL,
  "onboarding_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "checklist_item_id" TEXT,
  "scheduled" BOOLEAN NOT NULL DEFAULT false,
  "scheduled_at" TIMESTAMP(3),
  "meeting_url" TEXT,
  "leader_id" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnboardingMeeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientContract" (
  "id" TEXT NOT NULL,
  "onboarding_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "project_id" TEXT,
  "file_name" TEXT NOT NULL,
  "storage_bucket" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "mime_type" TEXT,
  "size_bytes" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'uploaded',
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "uploaded_by" TEXT NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupportGroup" (
  "id" TEXT NOT NULL,
  "onboarding_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "group_created" BOOLEAN NOT NULL DEFAULT false,
  "group_link" TEXT,
  "group_created_at" TIMESTAMP(3),
  "created_by" TEXT,
  "internal_participants" JSONB,
  "client_participants" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceLeaderMapping" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "leader_id" TEXT,
  "department_id" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceLeaderMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientOnboarding_project_id_key" ON "ClientOnboarding"("project_id");
CREATE INDEX IF NOT EXISTS "ClientOnboarding_workspace_id_status_idx" ON "ClientOnboarding"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "ClientOnboarding_company_id_idx" ON "ClientOnboarding"("company_id");
CREATE INDEX IF NOT EXISTS "ClientOnboarding_responsible_salesperson_id_idx" ON "ClientOnboarding"("responsible_salesperson_id");

CREATE INDEX IF NOT EXISTS "OnboardingChecklistItem_workspace_id_idx" ON "OnboardingChecklistItem"("workspace_id");
CREATE INDEX IF NOT EXISTS "OnboardingChecklistItem_onboarding_id_sort_order_idx" ON "OnboardingChecklistItem"("onboarding_id", "sort_order");
CREATE INDEX IF NOT EXISTS "OnboardingChecklistItem_owner_id_idx" ON "OnboardingChecklistItem"("owner_id");
CREATE INDEX IF NOT EXISTS "OnboardingChecklistItem_task_id_idx" ON "OnboardingChecklistItem"("task_id");

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingServiceAssignment_onboarding_id_service_key" ON "OnboardingServiceAssignment"("onboarding_id", "service");
CREATE INDEX IF NOT EXISTS "OnboardingServiceAssignment_workspace_id_idx" ON "OnboardingServiceAssignment"("workspace_id");
CREATE INDEX IF NOT EXISTS "OnboardingServiceAssignment_leader_id_idx" ON "OnboardingServiceAssignment"("leader_id");
CREATE INDEX IF NOT EXISTS "OnboardingServiceAssignment_department_id_idx" ON "OnboardingServiceAssignment"("department_id");

CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingMeeting_onboarding_id_service_key" ON "OnboardingMeeting"("onboarding_id", "service");
CREATE INDEX IF NOT EXISTS "OnboardingMeeting_workspace_id_idx" ON "OnboardingMeeting"("workspace_id");
CREATE INDEX IF NOT EXISTS "OnboardingMeeting_leader_id_idx" ON "OnboardingMeeting"("leader_id");
CREATE INDEX IF NOT EXISTS "OnboardingMeeting_checklist_item_id_idx" ON "OnboardingMeeting"("checklist_item_id");

CREATE INDEX IF NOT EXISTS "ClientContract_workspace_id_idx" ON "ClientContract"("workspace_id");
CREATE INDEX IF NOT EXISTS "ClientContract_company_id_idx" ON "ClientContract"("company_id");
CREATE INDEX IF NOT EXISTS "ClientContract_project_id_idx" ON "ClientContract"("project_id");
CREATE INDEX IF NOT EXISTS "ClientContract_onboarding_id_idx" ON "ClientContract"("onboarding_id");

CREATE UNIQUE INDEX IF NOT EXISTS "SupportGroup_onboarding_id_key" ON "SupportGroup"("onboarding_id");
CREATE INDEX IF NOT EXISTS "SupportGroup_workspace_id_idx" ON "SupportGroup"("workspace_id");
CREATE INDEX IF NOT EXISTS "SupportGroup_created_by_idx" ON "SupportGroup"("created_by");

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceLeaderMapping_workspace_id_service_key" ON "ServiceLeaderMapping"("workspace_id", "service");
CREATE INDEX IF NOT EXISTS "ServiceLeaderMapping_leader_id_idx" ON "ServiceLeaderMapping"("leader_id");
CREATE INDEX IF NOT EXISTS "ServiceLeaderMapping_department_id_idx" ON "ServiceLeaderMapping"("department_id");
CREATE INDEX IF NOT EXISTS "Project_responsible_salesperson_id_idx" ON "Project"("responsible_salesperson_id");

ALTER TABLE "Project" ADD CONSTRAINT "Project_responsible_salesperson_id_fkey" FOREIGN KEY ("responsible_salesperson_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_responsible_salesperson_id_fkey" FOREIGN KEY ("responsible_salesperson_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnboardingServiceAssignment" ADD CONSTRAINT "OnboardingServiceAssignment_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingServiceAssignment" ADD CONSTRAINT "OnboardingServiceAssignment_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingServiceAssignment" ADD CONSTRAINT "OnboardingServiceAssignment_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingServiceAssignment" ADD CONSTRAINT "OnboardingServiceAssignment_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnboardingMeeting" ADD CONSTRAINT "OnboardingMeeting_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingMeeting" ADD CONSTRAINT "OnboardingMeeting_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingMeeting" ADD CONSTRAINT "OnboardingMeeting_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "OnboardingChecklistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingMeeting" ADD CONSTRAINT "OnboardingMeeting_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientContract" ADD CONSTRAINT "ClientContract_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientContract" ADD CONSTRAINT "ClientContract_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientContract" ADD CONSTRAINT "ClientContract_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientContract" ADD CONSTRAINT "ClientContract_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientContract" ADD CONSTRAINT "ClientContract_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportGroup" ADD CONSTRAINT "SupportGroup_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "ClientOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportGroup" ADD CONSTRAINT "SupportGroup_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportGroup" ADD CONSTRAINT "SupportGroup_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceLeaderMapping" ADD CONSTRAINT "ServiceLeaderMapping_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceLeaderMapping" ADD CONSTRAINT "ServiceLeaderMapping_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceLeaderMapping" ADD CONSTRAINT "ServiceLeaderMapping_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
