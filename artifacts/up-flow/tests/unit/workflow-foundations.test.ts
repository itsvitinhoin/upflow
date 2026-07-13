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

  assert.match(collection, /readableProjectWhere/);
  assert.match(collection, /validateContributableProjectScope/);
  assert.match(collection, /validateContributableTaskScope/);
  assert.match(collection, /FREQ=/);
  assert.match(collection, /recurring_task_rule_created/);
  assert.match(item, /canManageRecurringRule/);
  assert.match(item, /validateContributableProjectScope/);
  assert.match(item, /validateContributableTaskScope/);
  assert.match(item, /recurring_task_rule_updated/);
  assert.match(item, /recurring_task_rule_deleted/);
});

test("automation rules are admin-only and have an execution runner", () => {
  const collection = read("src/app/api/automations/route.ts");
  const item = read("src/app/api/automations/[id]/route.ts");
  const runner = read("src/app/api/automations/run/route.ts");
  const cronRunner = read("src/app/api/cron/automations/route.ts");
  const runnerLib = read("src/lib/automation-runner.ts");

  assert.match(collection, /requireWorkspaceAdmin/);
  assert.match(collection, /task_overdue/);
  assert.match(collection, /no_client_activity_7_days/);
  assert.match(collection, /client_at_risk/);
  assert.match(collection, /weekly_friday_client_health_report/);
  assert.match(collection, /notify_admins/);
  assert.match(collection, /create_follow_up_task/);
  assert.match(collection, /generate_client_health_report/);
  assert.match(collection, /apply_template/);
  assert.match(collection, /automation_rule_created/);
  assert.match(item, /automation_rule_updated/);
  assert.match(item, /automation_rule_deleted/);
  assert.match(runner, /runAutomationRules/);
  assert.match(runner, /requireWorkspaceAdmin/);
  assert.match(cronRunner, /NODE_ENV === "production"/);
  assert.match(cronRunner, /Cron secret is not configured/);
  assert.match(runnerLib, /automation_runner_executed/);
  assert.match(runnerLib, /automation_notification_sent/);
  assert.match(runnerLib, /automation_task_created/);
  assert.match(runnerLib, /dryRun/);
});

test("goals expose workspace-scoped CRUD with admin-only write controls", () => {
  const collection = read("src/app/api/goals/route.ts");
  const item = read("src/app/api/goals/[id]/route.ts");

  assert.match(collection, /requireCurrentWorkspace/);
  assert.match(collection, /parsePagination/);
  assert.match(collection, /validateGoalOwner/);
  assert.match(collection, /requireWorkspaceAdmin/);
  assert.match(collection, /Goal owner must be an active member/);
  assert.match(collection, /goal_created/);
  assert.match(item, /requireWorkspaceAdmin/);
  assert.doesNotMatch(item, /canManageGoal/);
  assert.match(item, /goal_updated/);
  assert.match(item, /goal_deleted/);
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
  const actions = read("src/app/api/companies/[id]/report/actions/route.ts");
  const page = read("src/app/(dashboard)/clients/[id]/report/page.tsx");
  const detail = read("src/app/(dashboard)/clients/[id]/page.tsx");

  assert.match(route, /prisma\.task\.findMany/);
  assert.match(route, /prisma\.calendarEvent\.findMany/);
  assert.match(route, /prisma\.timeEntry\.findMany/);
  assert.match(route, /prisma\.companyNote\.findMany/);
  assert.match(route, /prisma\.activityEvent\.findMany/);
  assert.match(route, /markdown/);
  assert.match(actions, /approve_internal/);
  assert.match(actions, /send_to_client/);
  assert.match(actions, /archive_report/);
  assert.match(actions, /client_report_archived/);
  assert.match(page, /Narrative editor/);
  assert.match(page, /Approve internally/);
  assert.match(page, /Export markdown/);
  assert.match(page, /Export PDF/);
  assert.match(page, /Mark sent to client/);
  assert.match(page, /Archive report history/);
  assert.match(detail, /Report workflow/);
});

test("critical readiness e2e coverage documents permission, health, reporting, and audit flows", () => {
  const spec = read("tests/critical-readiness.spec.ts");

  assert.match(spec, /permissions are enforced for member and guest roles/);
  assert.match(spec, /client health center ranks clients needing attention/);
  assert.match(spec, /client report workflow can be previewed and archived/);
  assert.match(spec, /audit center exposes permission and report history/);
});

test("google calendar status reports readiness without claiming sync is connected", () => {
  const route = read("src/app/api/integrations/google-calendar/status/route.ts");

  assert.match(route, /GOOGLE_CALENDAR_CLIENT_ID/);
  assert.match(route, /GOOGLE_CALENDAR_CLIENT_SECRET/);
  assert.match(route, /GOOGLE_CALENDAR_REDIRECT_URI/);
  assert.match(route, /connected:\s*false/);
  assert.match(route, /Add a connect flow and token storage/);
});
