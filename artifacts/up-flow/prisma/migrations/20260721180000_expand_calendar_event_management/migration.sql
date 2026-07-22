-- Expand calendar events into durable event-management records while preserving
-- existing quick-create fields and records.
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'client_call';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'internal_meeting';

DO $$ BEGIN
  CREATE TYPE "CalendarEventStatus" AS ENUM ('scheduled', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CalendarEventAttachmentKind" AS ENUM ('file', 'link', 'document');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "space_id" TEXT,
  ADD COLUMN IF NOT EXISTS "responsible_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "status" "CalendarEventStatus" NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelled_by" TEXT;

CREATE TABLE IF NOT EXISTS "CalendarEventReminder" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "event_id" TEXT NOT NULL,
  "minutes_before" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventReminder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarEventReminder_minutes_before_check" CHECK ("minutes_before" > 0)
);

CREATE TABLE IF NOT EXISTS "CalendarEventAttachment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "event_id" TEXT NOT NULL,
  "kind" "CalendarEventAttachmentKind" NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT,
  "storage_bucket" TEXT,
  "storage_path" TEXT,
  "mime_type" TEXT,
  "size_bytes" INTEGER,
  "document_id" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarEventAttachment_size_bytes_check" CHECK ("size_bytes" IS NULL OR "size_bytes" >= 0),
  CONSTRAINT "CalendarEventAttachment_source_check" CHECK (
    ("kind" = 'file' AND "storage_bucket" IS NOT NULL AND "storage_path" IS NOT NULL AND "url" IS NULL AND "document_id" IS NULL)
    OR ("kind" = 'link' AND "url" IS NOT NULL AND "storage_bucket" IS NULL AND "storage_path" IS NULL AND "document_id" IS NULL)
    OR ("kind" = 'document' AND "document_id" IS NOT NULL AND "url" IS NULL AND "storage_bucket" IS NULL AND "storage_path" IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEventReminder_event_id_minutes_before_key"
  ON "CalendarEventReminder"("event_id", "minutes_before");
CREATE INDEX IF NOT EXISTS "CalendarEventReminder_event_id_enabled_idx"
  ON "CalendarEventReminder"("event_id", "enabled");
CREATE INDEX IF NOT EXISTS "CalendarEventAttachment_event_id_created_at_idx"
  ON "CalendarEventAttachment"("event_id", "created_at");
CREATE INDEX IF NOT EXISTS "CalendarEventAttachment_document_id_idx"
  ON "CalendarEventAttachment"("document_id");
CREATE INDEX IF NOT EXISTS "CalendarEventAttachment_created_by_idx"
  ON "CalendarEventAttachment"("created_by");
CREATE INDEX IF NOT EXISTS "CalendarEvent_space_id_idx" ON "CalendarEvent"("space_id");
CREATE INDEX IF NOT EXISTS "CalendarEvent_responsible_user_id_idx" ON "CalendarEvent"("responsible_user_id");
CREATE INDEX IF NOT EXISTS "CalendarEvent_workspace_id_status_starts_at_idx"
  ON "CalendarEvent"("workspace_id", "status", "starts_at");

ALTER TABLE "CalendarEvent"
  DROP CONSTRAINT IF EXISTS "CalendarEvent_space_id_fkey";
ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_space_id_fkey"
  FOREIGN KEY ("space_id") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent"
  DROP CONSTRAINT IF EXISTS "CalendarEvent_responsible_user_id_fkey";
ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_responsible_user_id_fkey"
  FOREIGN KEY ("responsible_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent"
  DROP CONSTRAINT IF EXISTS "CalendarEvent_cancelled_by_fkey";
ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_cancelled_by_fkey"
  FOREIGN KEY ("cancelled_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarEventReminder"
  DROP CONSTRAINT IF EXISTS "CalendarEventReminder_event_id_fkey";
ALTER TABLE "CalendarEventReminder"
  ADD CONSTRAINT "CalendarEventReminder_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEventAttachment"
  DROP CONSTRAINT IF EXISTS "CalendarEventAttachment_event_id_fkey";
ALTER TABLE "CalendarEventAttachment"
  ADD CONSTRAINT "CalendarEventAttachment_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEventAttachment"
  DROP CONSTRAINT IF EXISTS "CalendarEventAttachment_document_id_fkey";
ALTER TABLE "CalendarEventAttachment"
  ADD CONSTRAINT "CalendarEventAttachment_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarEventAttachment"
  DROP CONSTRAINT IF EXISTS "CalendarEventAttachment_created_by_fkey";
ALTER TABLE "CalendarEventAttachment"
  ADD CONSTRAINT "CalendarEventAttachment_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
