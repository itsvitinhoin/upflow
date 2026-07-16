CREATE TYPE "ImportJobStatus" AS ENUM ('previewed', 'queued', 'running', 'paused', 'completed', 'cancelled', 'failed');

CREATE TABLE "ImportJob" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "source_workspace_id" TEXT NOT NULL,
  "selected_source_ids" JSONB NOT NULL,
  "status" "ImportJobStatus" NOT NULL DEFAULT 'previewed',
  "cursor" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "imported" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "report" JSONB,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportJob_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ImportJob_workspace_id_status_idx" ON "ImportJob"("workspace_id", "status");
CREATE INDEX "ImportJob_created_by_idx" ON "ImportJob"("created_by");

CREATE TABLE "ImportMapping" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "source_workspace_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "target_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'imported',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportMapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportMapping_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImportMapping_source_workspace_id_entity_type_source_id_key" ON "ImportMapping"("source_workspace_id", "entity_type", "source_id");
CREATE INDEX "ImportMapping_job_id_status_idx" ON "ImportMapping"("job_id", "status");
CREATE INDEX "ImportMapping_workspace_id_entity_type_idx" ON "ImportMapping"("workspace_id", "entity_type");
