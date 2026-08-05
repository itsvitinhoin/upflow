import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function modelBlock(schema: string, model: string) {
  const match = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match, `${model} model should exist`);
  return match[1];
}

test("google calendar credentials and one-time OAuth state are workspace and user scoped", () => {
  const schema = read("prisma/schema.prisma");
  const connection = modelBlock(schema, "GoogleCalendarConnection");
  const oauthState = modelBlock(schema, "GoogleCalendarOAuthState");
  const eventLink = modelBlock(schema, "GoogleCalendarEventLink");
  const syncJob = modelBlock(schema, "GoogleCalendarSyncJob");

  assert.match(schema, /enum GoogleCalendarSyncStatus \{\s+pending\s+synced\s+failed\s+\}/);

  assert.match(connection, /workspace_id\s+String/);
  assert.match(connection, /user_id\s+String/);
  assert.match(connection, /access_token_ciphertext\s+String\?\s+@db\.Text/);
  assert.match(connection, /refresh_token_ciphertext\s+String\?\s+@db\.Text/);
  assert.match(connection, /disconnected_at\s+DateTime\?/);
  assert.match(connection, /@@unique\(\[workspace_id, user_id\]\)/);
  assert.match(connection, /sync_enabled\s+Boolean\s+@default\(true\)/);

  assert.match(oauthState, /state_hash\s+String\s+@unique\s+@db\.Text/);
  assert.match(oauthState, /code_verifier_ciphertext\s+String\s+@db\.Text/);
  assert.match(oauthState, /expires_at\s+DateTime/);
  assert.match(oauthState, /workspace\s+Workspace\s+@relation/);
  assert.match(oauthState, /user\s+User\s+@relation/);

  assert.match(eventLink, /event_id\s+String/);
  assert.match(eventLink, /connection_id\s+String/);
  assert.match(eventLink, /google_calendar_id\s+String/);
  assert.match(eventLink, /sync_status\s+GoogleCalendarSyncStatus\s+@default\(pending\)/);
  assert.match(eventLink, /@@unique\(\[event_id, connection_id\]\)/);

  assert.match(
    schema,
    /enum GoogleCalendarSyncOperation \{\s+upsert\s+delete\s+\}/,
  );
  assert.match(
    schema,
    /enum GoogleCalendarSyncJobStatus \{\s+pending\s+processing\s+completed\s+failed\s+cancelled\s+\}/,
  );
  assert.match(syncJob, /event_id\s+String\?/);
  assert.match(syncJob, /operation\s+GoogleCalendarSyncOperation/);
  assert.match(syncJob, /status\s+GoogleCalendarSyncJobStatus\s+@default\(pending\)/);
  assert.match(syncJob, /google_calendar_id\s+String\?/);
  assert.match(syncJob, /google_event_id\s+String\?/);
  assert.match(syncJob, /event\s+CalendarEvent\?\s+@relation\([^\n]*onDelete: SetNull/);
  assert.match(syncJob, /@@unique\(\[event_id, connection_id, operation\]\)/);
  assert.match(
    syncJob,
    /@@index\(\[workspace_id, user_id, status, next_attempt_at\]\)/,
  );
});

test("google calendar persistence migration blocks Supabase Data API roles", () => {
  const migration = read(
    "prisma/migrations/20260731190000_add_google_calendar_connections/migration.sql",
  );

  for (const table of [
    "GoogleCalendarConnection",
    "GoogleCalendarOAuthState",
    "GoogleCalendarEventLink",
    "GoogleCalendarSyncJob",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`));
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
    assert.match(
      migration,
      new RegExp(`REVOKE ALL ON TABLE "${table}" FROM anon, authenticated`),
    );
  }

  assert.match(
    migration,
    /GoogleCalendarConnection_workspace_id_fkey[\s\S]*?REFERENCES "Workspace"\("id"\)[\s\S]*?ON DELETE CASCADE/,
  );
  assert.match(
    migration,
    /GoogleCalendarConnection_user_id_fkey[\s\S]*?REFERENCES "User"\("id"\)[\s\S]*?ON DELETE CASCADE/,
  );
  assert.match(
    migration,
    /GoogleCalendarEventLink_event_id_fkey[\s\S]*?REFERENCES "CalendarEvent"\("id"\)[\s\S]*?ON DELETE CASCADE/,
  );
  assert.match(
    migration,
    /GoogleCalendarEventLink_connection_id_fkey[\s\S]*?REFERENCES "GoogleCalendarConnection"\("id"\)[\s\S]*?ON DELETE CASCADE/,
  );
  assert.match(
    migration,
    /GoogleCalendarSyncJob_workspace_id_fkey[\s\S]*?REFERENCES "Workspace"\("id"\)[\s\S]*?ON DELETE CASCADE/,
  );
  assert.match(
    migration,
    /GoogleCalendarSyncJob_user_id_fkey[\s\S]*?REFERENCES "User"\("id"\)[\s\S]*?ON DELETE CASCADE/,
  );
  assert.match(
    migration,
    /GoogleCalendarSyncJob_connection_id_fkey[\s\S]*?REFERENCES "GoogleCalendarConnection"\("id"\)[\s\S]*?ON DELETE CASCADE/,
  );
  assert.match(
    migration,
    /GoogleCalendarSyncJob_event_id_fkey[\s\S]*?REFERENCES "CalendarEvent"\("id"\)[\s\S]*?ON DELETE SET NULL/,
  );

  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS "access_token_ciphertext" TEXT,[\s\S]*?ADD COLUMN IF NOT EXISTS "refresh_token_ciphertext" TEXT,[\s\S]*?ADD COLUMN IF NOT EXISTS "disconnected_at" TIMESTAMP\(3\)/,
  );
  assert.match(
    migration,
    /ALTER COLUMN "access_token_ciphertext" DROP NOT NULL,[\s\S]*?ALTER COLUMN "refresh_token_ciphertext" DROP NOT NULL/,
  );
  assert.match(
    migration,
    /GoogleCalendarSyncJob_workspace_id_user_id_status_next_attempt_at_idx[\s\S]*?"workspace_id", "user_id", "status", "next_attempt_at"/,
  );
  assert.match(
    migration,
    /GoogleCalendarSyncJob_operation_payload_check[\s\S]*?"operation" = 'upsert'[\s\S]*?"event_id" IS NOT NULL[\s\S]*?"operation" = 'delete'[\s\S]*?"google_calendar_id" IS NOT NULL[\s\S]*?"google_event_id" IS NOT NULL/,
  );
  assert.match(
    migration,
    /GoogleCalendarSyncJob_attempt_count_nonnegative_check[\s\S]*?"attempt_count" >= 0/,
  );
});
