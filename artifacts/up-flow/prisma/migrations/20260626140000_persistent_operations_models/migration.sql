ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "approval_status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "approval_stage" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "approval_requested_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approval_approved_at" TIMESTAMP(3);

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "approval_status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "approval_stage" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "approval_requested_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approval_approved_at" TIMESTAMP(3);

ALTER TABLE "Doc"
  ADD COLUMN IF NOT EXISTS "approval_status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "approval_stage" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "approval_requested_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approval_approved_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "WorkflowStatus" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'task',
  "stage_order" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT,
  "terminal" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "stage" TEXT NOT NULL DEFAULT 'draft',
  "requested_by" TEXT NOT NULL,
  "approver_id" TEXT,
  "requested_changes" TEXT,
  "due_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApprovalEvent" (
  "id" TEXT NOT NULL,
  "approval_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "comment" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationRun" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "rule_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'success',
  "trigger" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "dry_run" BOOLEAN NOT NULL DEFAULT false,
  "matched" INTEGER NOT NULL DEFAULT 0,
  "executed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "dedupe_key" TEXT,
  "error" TEXT,
  "result" JSONB,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_by" TEXT,
  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClientReport" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "period_from" TIMESTAMP(3) NOT NULL,
  "period_to" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "narrative" TEXT,
  "markdown" TEXT,
  "pdf_url" TEXT,
  "approved_at" TIMESTAMP(3),
  "approved_by" TEXT,
  "sent_at" TIMESTAMP(3),
  "sent_by" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowStatus_workspace_id_project_id_category_key_key"
  ON "WorkflowStatus"("workspace_id", "project_id", "category", "key");
CREATE INDEX IF NOT EXISTS "WorkflowStatus_workspace_id_category_idx" ON "WorkflowStatus"("workspace_id", "category");
CREATE INDEX IF NOT EXISTS "WorkflowStatus_project_id_idx" ON "WorkflowStatus"("project_id");

CREATE INDEX IF NOT EXISTS "ApprovalRequest_workspace_id_status_idx" ON "ApprovalRequest"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_workspace_id_entity_type_entity_id_idx" ON "ApprovalRequest"("workspace_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_approver_id_idx" ON "ApprovalRequest"("approver_id");
CREATE INDEX IF NOT EXISTS "ApprovalEvent_approval_id_created_at_idx" ON "ApprovalEvent"("approval_id", "created_at");
CREATE INDEX IF NOT EXISTS "ApprovalEvent_workspace_id_created_at_idx" ON "ApprovalEvent"("workspace_id", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "AutomationRun_workspace_id_dedupe_key_key" ON "AutomationRun"("workspace_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "AutomationRun_workspace_id_started_at_idx" ON "AutomationRun"("workspace_id", "started_at");
CREATE INDEX IF NOT EXISTS "AutomationRun_rule_id_idx" ON "AutomationRun"("rule_id");
CREATE INDEX IF NOT EXISTS "AutomationRun_status_idx" ON "AutomationRun"("status");

CREATE INDEX IF NOT EXISTS "ClientReport_workspace_id_status_idx" ON "ClientReport"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "ClientReport_company_id_created_at_idx" ON "ClientReport"("company_id", "created_at");
CREATE INDEX IF NOT EXISTS "ClientReport_approved_by_idx" ON "ClientReport"("approved_by");
CREATE INDEX IF NOT EXISTS "ClientReport_sent_by_idx" ON "ClientReport"("sent_by");

ALTER TABLE "WorkflowStatus"
  ADD CONSTRAINT "WorkflowStatus_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkflowStatus_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApprovalRequest"
  ADD CONSTRAINT "ApprovalRequest_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ApprovalRequest_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ApprovalRequest_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApprovalEvent"
  ADD CONSTRAINT "ApprovalEvent_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ApprovalEvent_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ApprovalEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationRun"
  ADD CONSTRAINT "AutomationRun_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AutomationRun_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AutomationRun_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientReport"
  ADD CONSTRAINT "ClientReport_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ClientReport_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ClientReport_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ClientReport_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ClientReport_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
