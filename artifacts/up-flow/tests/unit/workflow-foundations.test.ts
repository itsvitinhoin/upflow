import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("saved views expose workspace-scoped per-user CRUD APIs", () => {
  const collection = read("src/app/api/saved-views/route.ts");
  const item = read("src/app/api/saved-views/[id]/route.ts");

  assert.match(collection, /requireCurrentWorkspace/);
  assert.match(collection, /user_id:\s*auth\.prismaUser\.id/);
  assert.match(collection, /buildPage/);
  assert.match(item, /user_id:\s*auth\.prismaUser\.id/);
  assert.match(item, /Saved view not found/);
});

test("recurring task rules validate workspace project and task scope", () => {
  const collection = read("src/app/api/recurring-task-rules/route.ts");
  const item = read("src/app/api/recurring-task-rules/[id]/route.ts");

  assert.match(collection, /validateProjectScope/);
  assert.match(collection, /validateTaskScope/);
  assert.match(collection, /FREQ=/);
  assert.match(collection, /recurring_task_rule_created/);
  assert.match(item, /recurring_task_rule_updated/);
  assert.match(item, /recurring_task_rule_deleted/);
});

test("automation rules are admin-only configuration and not a silent runner", () => {
  const collection = read("src/app/api/automations/route.ts");
  const item = read("src/app/api/automations/[id]/route.ts");

  assert.match(collection, /requireWorkspaceAdmin/);
  assert.match(collection, /task_overdue/);
  assert.match(collection, /apply_template/);
  assert.match(collection, /automation_rule_created/);
  assert.match(item, /automation_rule_updated/);
  assert.match(item, /automation_rule_deleted/);
});

test("dashboard detail endpoints are paginated for drawer-scale loading", () => {
  const general = read("src/app/api/dashboard/details/[group]/route.ts");
  const space = read("src/app/api/spaces/[id]/dashboard/details/[group]/route.ts");

  for (const route of [general, space]) {
    assert.match(route, /parsePagination/);
    assert.match(route, /buildPage/);
    assert.match(route, /urgent-actions/);
    assert.match(route, /meetings-today/);
    assert.match(route, /projects-at-risk/);
    assert.doesNotMatch(route, /take:\s*500/);
    assert.doesNotMatch(route, /take:\s*1000/);
  }
});

test("client report endpoint uses real records and returns a markdown report", () => {
  const route = read("src/app/api/companies/[id]/report/route.ts");

  assert.match(route, /prisma\.task\.findMany/);
  assert.match(route, /prisma\.calendarEvent\.findMany/);
  assert.match(route, /prisma\.timeEntry\.findMany/);
  assert.match(route, /prisma\.companyNote\.findMany/);
  assert.match(route, /prisma\.activityEvent\.findMany/);
  assert.match(route, /markdown/);
});

test("google calendar status reports readiness without claiming sync is connected", () => {
  const route = read("src/app/api/integrations/google-calendar/status/route.ts");

  assert.match(route, /GOOGLE_CALENDAR_CLIENT_ID/);
  assert.match(route, /GOOGLE_CALENDAR_CLIENT_SECRET/);
  assert.match(route, /GOOGLE_CALENDAR_REDIRECT_URI/);
  assert.match(route, /connected:\s*false/);
  assert.match(route, /Add a connect flow and token storage/);
});
