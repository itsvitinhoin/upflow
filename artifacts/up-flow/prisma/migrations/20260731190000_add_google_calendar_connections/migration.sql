-- Store per-user Google Calendar OAuth credentials server-side only. These
-- tables intentionally have no browser/Data API policies: the Next.js server
-- accesses them through Prisma after workspace authorization checks.
DO $$ BEGIN
  CREATE TYPE "GoogleCalendarSyncStatus" AS ENUM ('pending', 'synced', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GoogleCalendarSyncOperation" AS ENUM ('upsert', 'delete');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GoogleCalendarSyncJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GoogleCalendarConnection" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "google_subject" TEXT,
  "google_email" TEXT,
  "google_name" TEXT,
  "calendar_id" TEXT NOT NULL DEFAULT 'primary',
  "calendar_name" TEXT,
  "access_token_ciphertext" TEXT,
  "refresh_token_ciphertext" TEXT,
  "token_expires_at" TIMESTAMP(3),
  "scope" TEXT,
  "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
  "disconnected_at" TIMESTAMP(3),
  "last_synced_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoogleCalendarOAuthState" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "state_hash" TEXT NOT NULL,
  "code_verifier_ciphertext" TEXT NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleCalendarOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoogleCalendarEventLink" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "event_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "google_calendar_id" TEXT NOT NULL,
  "google_event_id" TEXT,
  "google_event_etag" TEXT,
  "google_event_url" TEXT,
  "sync_status" "GoogleCalendarSyncStatus" NOT NULL DEFAULT 'pending',
  "last_synced_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleCalendarEventLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoogleCalendarSyncJob" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "event_id" TEXT,
  "operation" "GoogleCalendarSyncOperation" NOT NULL,
  "force" BOOLEAN NOT NULL DEFAULT false,
  "google_calendar_id" TEXT,
  "google_event_id" TEXT,
  "status" "GoogleCalendarSyncJobStatus" NOT NULL DEFAULT 'pending',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_token" TEXT,
  "locked_until" TIMESTAMP(3),
  "last_error" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleCalendarSyncJob_pkey" PRIMARY KEY ("id")
);

-- These statements make the migration safe if an earlier local development
-- attempt created the connection table before the durable outbox landed.
-- Both encrypted token columns must be nullable: disconnecting removes the
-- credentials while retaining the connection row and its remote-event links.
ALTER TABLE "GoogleCalendarConnection"
  ADD COLUMN IF NOT EXISTS "access_token_ciphertext" TEXT,
  ADD COLUMN IF NOT EXISTS "refresh_token_ciphertext" TEXT,
  ADD COLUMN IF NOT EXISTS "disconnected_at" TIMESTAMP(3);
ALTER TABLE "GoogleCalendarConnection"
  ALTER COLUMN "access_token_ciphertext" DROP NOT NULL,
  ALTER COLUMN "refresh_token_ciphertext" DROP NOT NULL;

ALTER TABLE "GoogleCalendarSyncJob"
  ADD COLUMN IF NOT EXISTS "force" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "GoogleCalendarSyncJob"
  ADD COLUMN IF NOT EXISTS "lease_token" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarConnection_workspace_id_user_id_key"
  ON "GoogleCalendarConnection"("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "GoogleCalendarConnection_user_id_idx"
  ON "GoogleCalendarConnection"("user_id");
CREATE INDEX IF NOT EXISTS "GoogleCalendarConnection_workspace_id_sync_enabled_idx"
  ON "GoogleCalendarConnection"("workspace_id", "sync_enabled");

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarOAuthState_state_hash_key"
  ON "GoogleCalendarOAuthState"("state_hash");
CREATE INDEX IF NOT EXISTS "GoogleCalendarOAuthState_workspace_id_user_id_idx"
  ON "GoogleCalendarOAuthState"("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "GoogleCalendarOAuthState_expires_at_idx"
  ON "GoogleCalendarOAuthState"("expires_at");

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarEventLink_event_id_connection_id_key"
  ON "GoogleCalendarEventLink"("event_id", "connection_id");
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarEventLink_connection_id_google_calendar_id_google_event_id_key"
  ON "GoogleCalendarEventLink"("connection_id", "google_calendar_id", "google_event_id");
CREATE INDEX IF NOT EXISTS "GoogleCalendarEventLink_event_id_idx"
  ON "GoogleCalendarEventLink"("event_id");
CREATE INDEX IF NOT EXISTS "GoogleCalendarEventLink_connection_id_sync_status_idx"
  ON "GoogleCalendarEventLink"("connection_id", "sync_status");

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarSyncJob_event_id_connection_id_operation_key"
  ON "GoogleCalendarSyncJob"("event_id", "connection_id", "operation");
CREATE INDEX IF NOT EXISTS "GoogleCalendarSyncJob_status_next_attempt_at_idx"
  ON "GoogleCalendarSyncJob"("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "GoogleCalendarSyncJob_workspace_id_user_id_status_next_attempt_at_idx"
  ON "GoogleCalendarSyncJob"("workspace_id", "user_id", "status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "GoogleCalendarSyncJob_connection_id_status_idx"
  ON "GoogleCalendarSyncJob"("connection_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarConnection_workspace_id_fkey'
      AND conrelid = '"GoogleCalendarConnection"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarConnection"
      ADD CONSTRAINT "GoogleCalendarConnection_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarConnection_user_id_fkey'
      AND conrelid = '"GoogleCalendarConnection"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarConnection"
      ADD CONSTRAINT "GoogleCalendarConnection_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarOAuthState_workspace_id_fkey'
      AND conrelid = '"GoogleCalendarOAuthState"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarOAuthState"
      ADD CONSTRAINT "GoogleCalendarOAuthState_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarOAuthState_user_id_fkey'
      AND conrelid = '"GoogleCalendarOAuthState"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarOAuthState"
      ADD CONSTRAINT "GoogleCalendarOAuthState_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarEventLink_event_id_fkey'
      AND conrelid = '"GoogleCalendarEventLink"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarEventLink"
      ADD CONSTRAINT "GoogleCalendarEventLink_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "CalendarEvent"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarEventLink_connection_id_fkey'
      AND conrelid = '"GoogleCalendarEventLink"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarEventLink"
      ADD CONSTRAINT "GoogleCalendarEventLink_connection_id_fkey"
      FOREIGN KEY ("connection_id") REFERENCES "GoogleCalendarConnection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarSyncJob_workspace_id_fkey'
      AND conrelid = '"GoogleCalendarSyncJob"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarSyncJob"
      ADD CONSTRAINT "GoogleCalendarSyncJob_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarSyncJob_user_id_fkey'
      AND conrelid = '"GoogleCalendarSyncJob"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarSyncJob"
      ADD CONSTRAINT "GoogleCalendarSyncJob_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarSyncJob_connection_id_fkey'
      AND conrelid = '"GoogleCalendarSyncJob"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarSyncJob"
      ADD CONSTRAINT "GoogleCalendarSyncJob_connection_id_fkey"
      FOREIGN KEY ("connection_id") REFERENCES "GoogleCalendarConnection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarSyncJob_event_id_fkey'
      AND conrelid = '"GoogleCalendarSyncJob"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarSyncJob"
      ADD CONSTRAINT "GoogleCalendarSyncJob_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "CalendarEvent"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarSyncJob_operation_payload_check'
      AND conrelid = '"GoogleCalendarSyncJob"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarSyncJob"
      ADD CONSTRAINT "GoogleCalendarSyncJob_operation_payload_check"
      CHECK (
        ("operation" = 'upsert' AND "event_id" IS NOT NULL)
        OR (
          "operation" = 'delete'
          AND "google_calendar_id" IS NOT NULL
          AND "google_event_id" IS NOT NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarSyncJob_attempt_count_nonnegative_check'
      AND conrelid = '"GoogleCalendarSyncJob"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarSyncJob"
      ADD CONSTRAINT "GoogleCalendarSyncJob_attempt_count_nonnegative_check"
      CHECK ("attempt_count" >= 0);
  END IF;
END $$;

-- Defense in depth for Supabase's exposed public schema: OAuth state and
-- encrypted credentials must never be accessible to anon/authenticated roles.
ALTER TABLE "GoogleCalendarConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoogleCalendarOAuthState" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoogleCalendarEventLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoogleCalendarSyncJob" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "GoogleCalendarConnection" FROM anon, authenticated;
REVOKE ALL ON TABLE "GoogleCalendarOAuthState" FROM anon, authenticated;
REVOKE ALL ON TABLE "GoogleCalendarEventLink" FROM anon, authenticated;
REVOKE ALL ON TABLE "GoogleCalendarSyncJob" FROM anon, authenticated;
