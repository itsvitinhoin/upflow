DO $$ BEGIN
  CREATE TYPE "CalendarEventType" AS ENUM ('meeting', 'task', 'reminder', 'deadline');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TimeEntryStatus" AS ENUM ('running', 'stopped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "CalendarEventType" NOT NULL DEFAULT 'meeting',
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3),
  "timezone" TEXT,
  "created_by" TEXT NOT NULL,
  "project_id" TEXT,
  "task_id" TEXT,
  "location" TEXT,
  "meeting_url" TEXT,
  "color" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarEventAttendee" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventAttendee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TimeEntry" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "project_id" TEXT,
  "task_id" TEXT,
  "description" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL,
  "stopped_at" TIMESTAMP(3),
  "duration_seconds" INTEGER NOT NULL DEFAULT 0,
  "status" "TimeEntryStatus" NOT NULL DEFAULT 'running',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityEvent" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "type" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "project_id" TEXT,
  "task_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Company" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "website" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "owner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectMember" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TaskDependency" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "depends_on_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RecurringTaskRule" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "project_id" TEXT,
  "task_id" TEXT,
  "name" TEXT NOT NULL,
  "rrule" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringTaskRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SavedView" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationRule" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "action" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Goal" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "target_value" DOUBLE PRECISION,
  "current_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "due_date" TIMESTAMP(3),
  "owner_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEventAttendee_event_id_user_id_key" ON "CalendarEventAttendee"("event_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_project_id_user_id_key" ON "ProjectMember"("project_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "TaskDependency_task_id_depends_on_id_key" ON "TaskDependency"("task_id", "depends_on_id");

CREATE INDEX IF NOT EXISTS "CalendarEvent_workspace_id_starts_at_idx" ON "CalendarEvent"("workspace_id", "starts_at");
CREATE INDEX IF NOT EXISTS "CalendarEvent_created_by_idx" ON "CalendarEvent"("created_by");
CREATE INDEX IF NOT EXISTS "CalendarEvent_project_id_idx" ON "CalendarEvent"("project_id");
CREATE INDEX IF NOT EXISTS "CalendarEvent_task_id_idx" ON "CalendarEvent"("task_id");
CREATE INDEX IF NOT EXISTS "CalendarEventAttendee_user_id_idx" ON "CalendarEventAttendee"("user_id");
CREATE INDEX IF NOT EXISTS "TimeEntry_workspace_id_started_at_idx" ON "TimeEntry"("workspace_id", "started_at");
CREATE INDEX IF NOT EXISTS "TimeEntry_user_id_status_idx" ON "TimeEntry"("user_id", "status");
CREATE INDEX IF NOT EXISTS "TimeEntry_project_id_idx" ON "TimeEntry"("project_id");
CREATE INDEX IF NOT EXISTS "TimeEntry_task_id_idx" ON "TimeEntry"("task_id");
CREATE INDEX IF NOT EXISTS "ActivityEvent_workspace_id_created_at_idx" ON "ActivityEvent"("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "ActivityEvent_actor_id_idx" ON "ActivityEvent"("actor_id");
CREATE INDEX IF NOT EXISTS "ActivityEvent_project_id_idx" ON "ActivityEvent"("project_id");
CREATE INDEX IF NOT EXISTS "ActivityEvent_task_id_idx" ON "ActivityEvent"("task_id");
CREATE INDEX IF NOT EXISTS "Company_workspace_id_idx" ON "Company"("workspace_id");
CREATE INDEX IF NOT EXISTS "Company_owner_id_idx" ON "Company"("owner_id");
CREATE INDEX IF NOT EXISTS "ProjectMember_user_id_idx" ON "ProjectMember"("user_id");
CREATE INDEX IF NOT EXISTS "TaskDependency_depends_on_id_idx" ON "TaskDependency"("depends_on_id");
CREATE INDEX IF NOT EXISTS "RecurringTaskRule_workspace_id_idx" ON "RecurringTaskRule"("workspace_id");
CREATE INDEX IF NOT EXISTS "RecurringTaskRule_project_id_idx" ON "RecurringTaskRule"("project_id");
CREATE INDEX IF NOT EXISTS "RecurringTaskRule_task_id_idx" ON "RecurringTaskRule"("task_id");
CREATE INDEX IF NOT EXISTS "SavedView_workspace_id_user_id_idx" ON "SavedView"("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "AutomationRule_workspace_id_idx" ON "AutomationRule"("workspace_id");
CREATE INDEX IF NOT EXISTS "Goal_workspace_id_idx" ON "Goal"("workspace_id");
CREATE INDEX IF NOT EXISTS "Goal_owner_id_idx" ON "Goal"("owner_id");

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CalendarEvent_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CalendarEvent_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CalendarEvent_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalendarEventAttendee"
  ADD CONSTRAINT "CalendarEventAttendee_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CalendarEventAttendee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeEntry"
  ADD CONSTRAINT "TimeEntry_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TimeEntry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TimeEntry_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TimeEntry_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActivityEvent"
  ADD CONSTRAINT "ActivityEvent_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ActivityEvent_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Company_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ProjectMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskDependency"
  ADD CONSTRAINT "TaskDependency_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TaskDependency_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecurringTaskRule"
  ADD CONSTRAINT "RecurringTaskRule_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "RecurringTaskRule_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "RecurringTaskRule_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "RecurringTaskRule_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedView"
  ADD CONSTRAINT "SavedView_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SavedView_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AutomationRule"
  ADD CONSTRAINT "AutomationRule_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AutomationRule_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Goal"
  ADD CONSTRAINT "Goal_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Goal_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
