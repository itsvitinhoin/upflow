import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("time tracking prevents duplicate running timers and keeps running endpoint compatible", () => {
  const runningRoute = read("src/app/api/time/running/route.ts");
  const entriesRoute = read("src/app/api/time/entries/route.ts");
  const migration = read(
    "prisma/migrations/20260526122000_one_running_timer_per_user/migration.sql",
  );

  assert.match(runningRoute, /entry\s*\?\s*\{\s*\.\.\.entry,\s*entry\s*\}/s);
  assert.match(entriesRoute, /if\s*\(!stoppedAt\)\s*\{/);
  assert.match(entriesRoute, /status:\s*"running"/);
  assert.match(entriesRoute, /return NextResponse\.json\(existing,\s*\{\s*status:\s*200\s*\}\)/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS/);
  assert.match(migration, /WHERE "status" = 'running'/);
});
