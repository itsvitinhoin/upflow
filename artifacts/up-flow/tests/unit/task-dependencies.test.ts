import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("task dependency APIs are workspace scoped, cycle safe, and activity tracked", () => {
  const collectionRoute = read("src/app/api/tasks/[id]/dependencies/route.ts");
  const itemRoute = read("src/app/api/tasks/[id]/dependencies/[dependencyId]/route.ts");
  const taskRoute = read("src/app/api/tasks/[id]/route.ts");

  assert.match(collectionRoute, /canAccessWorkspace/);
  assert.match(collectionRoute, /isWorkspaceAdminFor/);
  assert.match(collectionRoute, /createsCycle/);
  assert.match(collectionRoute, /A task cannot depend on itself/);
  assert.match(collectionRoute, /Dependencies must stay inside the same workspace/);
  assert.match(collectionRoute, /task_dependency_added/);
  assert.match(itemRoute, /task_dependency_removed/);
  assert.match(taskRoute, /dependencies:\s*{/);
  assert.match(taskRoute, /dependents:\s*{/);
});

test("space dashboard avoids broad fixed 500-row task and time caps for operational counts", () => {
  const route = read("src/app/api/spaces/[id]/dashboard/route.ts");

  assert.match(route, /DASHBOARD_EVIDENCE_LIMIT/);
  assert.match(route, /urgentActionCount/);
  assert.match(route, /openTaskCountsByAssignee/);
  assert.match(route, /overdueTaskCountsByProject/);
  assert.doesNotMatch(route, /take:\s*500/);
  assert.doesNotMatch(route, /take:\s*1000/);
});

test("legacy dashboard uses bounded evidence windows instead of old broad caps", () => {
  const route = read("src/app/api/dashboard/route.ts");

  assert.match(route, /DASHBOARD_EVIDENCE_LIMIT/);
  assert.doesNotMatch(route, /take:\s*500/);
  assert.doesNotMatch(route, /take:\s*200/);
  assert.match(route, /distinct:\s*\["project_id"\]/);
  assert.match(route, /distinct:\s*\["company_id"\]/);
});
