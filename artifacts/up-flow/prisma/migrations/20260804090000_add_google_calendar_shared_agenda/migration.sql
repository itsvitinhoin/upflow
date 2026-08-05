-- Cache a sanitized version of each connected employee's Google agenda so
-- active workspace members can coordinate schedules without access to OAuth
-- credentials or sensitive provider event metadata.
ALTER TABLE "GoogleCalendarConnection"
  ADD COLUMN IF NOT EXISTS "share_agenda" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "agenda_last_synced_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "agenda_last_error" TEXT;

CREATE TABLE IF NOT EXISTS "GoogleCalendarAgendaEntry" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "google_calendar_id" TEXT NOT NULL,
  "google_event_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "all_day" BOOLEAN NOT NULL DEFAULT false,
  "is_private" BOOLEAN NOT NULL DEFAULT false,
  "source_updated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleCalendarAgendaEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GoogleCalendarConnection_workspace_id_share_agenda_idx"
  ON "GoogleCalendarConnection"("workspace_id", "share_agenda");
CREATE INDEX IF NOT EXISTS "GoogleCalendarConnection_share_agenda_agenda_last_synced_at_idx"
  ON "GoogleCalendarConnection"("share_agenda", "agenda_last_synced_at");
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarAgendaEntry_connection_id_google_calendar_id_google_event_id_key"
  ON "GoogleCalendarAgendaEntry"("connection_id", "google_calendar_id", "google_event_id");
CREATE INDEX IF NOT EXISTS "GoogleCalendarAgendaEntry_workspace_id_starts_at_idx"
  ON "GoogleCalendarAgendaEntry"("workspace_id", "starts_at");
CREATE INDEX IF NOT EXISTS "GoogleCalendarAgendaEntry_workspace_id_user_id_starts_at_idx"
  ON "GoogleCalendarAgendaEntry"("workspace_id", "user_id", "starts_at");
CREATE INDEX IF NOT EXISTS "GoogleCalendarAgendaEntry_connection_id_starts_at_idx"
  ON "GoogleCalendarAgendaEntry"("connection_id", "starts_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarAgendaEntry_workspace_id_fkey'
      AND conrelid = '"GoogleCalendarAgendaEntry"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarAgendaEntry"
      ADD CONSTRAINT "GoogleCalendarAgendaEntry_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarAgendaEntry_user_id_fkey'
      AND conrelid = '"GoogleCalendarAgendaEntry"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarAgendaEntry"
      ADD CONSTRAINT "GoogleCalendarAgendaEntry_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GoogleCalendarAgendaEntry_connection_id_fkey'
      AND conrelid = '"GoogleCalendarAgendaEntry"'::regclass
  ) THEN
    ALTER TABLE "GoogleCalendarAgendaEntry"
      ADD CONSTRAINT "GoogleCalendarAgendaEntry_connection_id_fkey"
      FOREIGN KEY ("connection_id") REFERENCES "GoogleCalendarConnection"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Keep provider-derived agendas on the server side of the application.
ALTER TABLE "GoogleCalendarAgendaEntry" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "GoogleCalendarAgendaEntry" FROM anon, authenticated;
