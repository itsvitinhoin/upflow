import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("time tracking prevents duplicate open timers and keeps running endpoint compatible", () => {
  const runningRoute = read("src/app/api/time/running/route.ts");
  const startRoute = read("src/app/api/time/start/route.ts");
  const entriesRoute = read("src/app/api/time/entries/route.ts");
  const pauseRoute = read("src/app/api/time/pause/route.ts");
  const resumeRoute = read("src/app/api/time/resume/route.ts");
  const timePage = read("src/app/(dashboard)/time/page.tsx");
  const dashboard = read("src/app/(dashboard)/page.tsx");
  const teamTimeline = read("src/components/dashboard/team-timeline.tsx");
  const companiesRoute = read("src/app/api/companies/route.ts");
  const companyRoute = read("src/app/api/companies/[id]/route.ts");
  const companyReportRoute = read("src/app/api/companies/[id]/report/route.ts");
  const migration = read(
    "prisma/migrations/20260731120000_add_time_entry_pause_state/migration.sql",
  );

  assert.match(runningRoute, /entry\s*\?\s*\{\s*\.\.\.entry,\s*entry\s*\}/s);
  assert.match(startRoute, /function findOpenEntry/);
  assert.match(startRoute, /status:\s*\{\s*not:\s*"stopped"\s*\}/);
  assert.match(startRoute, /isWorkspaceAdminFor\(auth,\s*auth\.currentWorkspaceId\)/);
  assert.match(startRoute, /PrismaClientKnownRequestError/);
  assert.match(startRoute, /err\.code\s*===\s*"P2002"/);
  assert.match(entriesRoute, /if\s*\(!stoppedAt\)\s*\{/);
  assert.match(entriesRoute, /function findOpenEntry/);
  assert.match(entriesRoute, /isWorkspaceAdminFor\(auth,\s*auth\.currentWorkspaceId\)/);
  assert.match(entriesRoute, /active_started_at:\s*stoppedAt\s*\?\s*null\s*:\s*startedAt/);
  assert.match(entriesRoute, /return NextResponse\.json\(existing,\s*\{\s*status:\s*200\s*\}\)/);
  assert.match(entriesRoute, /PrismaClientKnownRequestError/);
  assert.match(entriesRoute, /err\.code\s*===\s*"P2002"/);
  assert.match(pauseRoute, /status:\s*"paused"/);
  assert.doesNotMatch(pauseRoute, /active_started_at:\s*null/);
  assert.match(pauseRoute, /paused_at:\s*pausedAt/);
  assert.match(pauseRoute, /updateMany/);
  assert.match(pauseRoute, /status:\s*"running"/);
  assert.match(resumeRoute, /status:\s*"running"/);
  assert.match(resumeRoute, /active_started_at:\s*new Date\(\)/);
  assert.match(resumeRoute, /paused_at:\s*null/);
  assert.match(resumeRoute, /updateMany/);
  assert.match(resumeRoute, /status:\s*"paused"/);
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'paused'/);
  assert.match(migration, /active_started_at/);
  assert.match(migration, /paused_at/);
  assert.match(migration, /WHERE "status" <> 'stopped'/);
  assert.match(timePage, /appDateKey/);
  assert.match(timePage, /appDateTimeToUtc/);
  assert.match(timePage, /\/api\/time\/start/);
  assert.match(timePage, /\/api\/time\/resume/);
  assert.match(timePage, /\/api\/time\/pause/);
  assert.match(timePage, /\/api\/time\/stop/);
  assert.match(timePage, /\/api\/time\/running/);
  assert.match(timePage, /mergeRunningEntry/);
  assert.match(timePage, /activeEntry/);
  assert.match(timePage, /handleStartTimer/);
  assert.match(timePage, /handleStopTimer/);
  assert.match(timePage, /handlePauseTimer/);
  assert.match(timePage, /<Play className=/);
  assert.match(timePage, /<Square className=/);
  assert.match(timePage, /t\("time\.startTimer"\)/);
  assert.match(timePage, /t\("time\.stopTimer"\)/);
  assert.match(timePage, /activeDays\s*>\s*0\s*\?\s*Math\.round\(weekSeconds\s*\/\s*60\s*\/\s*activeDays\)/);
  assert.doesNotMatch(timePage, /setHours\(0,\s*0,\s*0,\s*0\)/);
  assert.match(dashboard, /\/api\/time\/pause/);
  assert.match(dashboard, /\/api\/time\/resume/);
  assert.match(dashboard, /const handlePause = async/);
  assert.doesNotMatch(dashboard, /pauseUnavailable/);
  assert.match(teamTimeline, /timelineRangeForTimeEntry/);
  assert.match(teamTimeline, /entry\.active_started_at\s*\?\?\s*entry\.started_at/);
  assert.match(teamTimeline, /entry\.paused_at/);
  assert.match(companiesRoute, /timeEntryDurationSeconds/);
  assert.match(companiesRoute, /active_started_at:\s*true/);
  assert.match(companyRoute, /timeEntryDurationSeconds/);
  assert.match(companyRoute, /active_started_at:\s*true/);
  assert.match(companyReportRoute, /timeEntryDurationSeconds/);
});
