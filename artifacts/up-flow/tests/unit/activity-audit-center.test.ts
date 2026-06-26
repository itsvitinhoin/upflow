import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("activity API supports audit filters and cursor pagination", () => {
  const route = read("src/app/api/activity/route.ts");

  assert.match(route, /parsePagination/);
  assert.match(route, /buildPage/);
  assert.match(route, /entity_type/);
  assert.match(route, /actor_id/);
  assert.match(route, /company_id/);
  assert.match(route, /project_id/);
  assert.match(route, /task_id/);
  assert.match(route, /company:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true/);
});

test("activity audit center is available from navigation", () => {
  const page = read("src/app/(dashboard)/activity/page.tsx");
  const rail = read("src/components/layout/sidebar/rail.tsx");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(page, /\/api\/activity/);
  assert.match(page, /Activity and audit log/);
  assert.match(page, /metadata/);
  assert.match(page, /entity_type/);
  assert.match(rail, /href:\s*"\/activity"/);
  assert.match(translations, /"nav\.activity":\s*"Activity"/);
  assert.match(translations, /"nav\.activity":\s*"Atividade"/);
});

test("readiness docs reflect the current permission model", () => {
  const crudChecklist = read("docs/crud-qa-checklist.md");
  const finalAcceptance = read("docs/final-acceptance-test.md");
  const rollout = read("docs/internal-rollout-plan.md");

  assert.match(crudChecklist, /members and guests are view-only under the current policy/);
  assert.match(crudChecklist, /Try to start or stop time tracking/);
  assert.match(crudChecklist, /only the owner can delete it/i);
  assert.match(finalAcceptance, /members and guests cannot delete or mutate tasks/);
  assert.match(finalAcceptance, /workspace deletion is owner-only/i);
  assert.match(rollout, /Members and guests can view workspace records without mutating them/);
});
