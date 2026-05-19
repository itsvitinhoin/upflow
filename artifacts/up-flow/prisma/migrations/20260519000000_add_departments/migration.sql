-- Add Department concept for grouping workspace members.

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'slate',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_workspace_id_name_key"
  ON "Department"("workspace_id", "name");
CREATE INDEX "Department_workspace_id_idx" ON "Department"("workspace_id");

ALTER TABLE "Department"
  ADD CONSTRAINT "Department_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD COLUMN "department_id" TEXT;
CREATE INDEX "WorkspaceMember_department_id_idx"
  ON "WorkspaceMember"("department_id");
ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "Department"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
