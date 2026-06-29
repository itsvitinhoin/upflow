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
  const startRoute = read("src/app/api/time/start/route.ts");
  const entriesRoute = read("src/app/api/time/entries/route.ts");
  const timePage = read("src/app/(dashboard)/time/page.tsx");
  const migration = read(
    "prisma/migrations/20260526122000_one_running_timer_per_user/migration.sql",
  );

  assert.match(runningRoute, /entry\s*\?\s*\{\s*\.\.\.entry,\s*entry\s*\}/s);
  assert.match(startRoute, /function findRunningEntry/);
  assert.match(startRoute, /isWorkspaceAdminFor\(auth,\s*auth\.currentWorkspaceId\)/);
  assert.match(startRoute, /PrismaClientKnownRequestError/);
  assert.match(startRoute, /err\.code\s*===\s*"P2002"/);
  assert.match(entriesRoute, /if\s*\(!stoppedAt\)\s*\{/);
  assert.match(entriesRoute, /isWorkspaceAdminFor\(auth,\s*auth\.currentWorkspaceId\)/);
  assert.match(entriesRoute, /status:\s*"running"/);
  assert.match(entriesRoute, /return NextResponse\.json\(existing,\s*\{\s*status:\s*200\s*\}\)/);
  assert.match(entriesRoute, /PrismaClientKnownRequestError/);
  assert.match(entriesRoute, /err\.code\s*===\s*"P2002"/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS/);
  assert.match(migration, /WHERE "status" = 'running'/);
  assert.match(timePage, /appDateKey/);
  assert.match(timePage, /appDateTimeToUtc/);
  assert.match(timePage, /\/api\/time\/start/);
  assert.match(timePage, /\/api\/time\/stop/);
  assert.match(timePage, /\/api\/time\/running/);
  assert.match(timePage, /mergeRunningEntry/);
  assert.match(timePage, /handleStartTimer/);
  assert.match(timePage, /handleStopTimer/);
  assert.match(timePage, /<Play className=/);
  assert.match(timePage, /<Square className=/);
  assert.match(timePage, /t\("time\.startTimer"\)/);
  assert.match(timePage, /t\("time\.stopTimer"\)/);
  assert.match(timePage, /activeDays\s*>\s*0\s*\?\s*Math\.round\(weekSeconds\s*\/\s*60\s*\/\s*activeDays\)/);
  assert.doesNotMatch(timePage, /setHours\(0,\s*0,\s*0,\s*0\)/);
});
