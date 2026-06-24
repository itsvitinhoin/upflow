import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("dashboard risk rules only claim traceable database-backed signals", () => {
  const summaryRoute = read("src/app/api/dashboard/summary/route.ts");
  const legacyRoute = read("src/app/api/dashboard/route.ts");
  const spaceRoute = read("src/app/api/spaces/[id]/dashboard/route.ts");

  for (const route of [summaryRoute, legacyRoute, spaceRoute]) {
    assert.match(route, /rules:\s*\["overdue open tasks", "no owner", "no activity in 7 days"\]/);
    assert.doesNotMatch(route, /blocked tasks/);
    assert.doesNotMatch(route, /no due-date movement/);
  }
});

test("workload signals expose task evidence in dashboard drawers", () => {
  const summaryRoute = read("src/app/api/dashboard/summary/route.ts");
  const legacyRoute = read("src/app/api/dashboard/route.ts");
  const spaceRoute = read("src/app/api/spaces/[id]/dashboard/route.ts");
  const homeDashboard = read("src/app/(dashboard)/page.tsx");
  const spaceDashboardDrawer = read("src/components/spaces/space-dashboard-drawer.tsx");

  for (const route of [summaryRoute, legacyRoute, spaceRoute]) {
    assert.match(route, /tasks:\s*assignedOpenTasks\.slice\(0, 8\)/);
  }

  assert.match(homeDashboard, /t\("dashboard\.noWorkloadTasks"\)/);
  assert.match(homeDashboard, /item\.tasks\.map/);
  assert.match(spaceDashboardDrawer, /t\("spaceDashboard\.noOpenAssignedTasks"\)/);
  assert.match(spaceDashboardDrawer, /item\.tasks\.map/);
});

test("dashboard copy avoids unsupported operational claims", () => {
  const translations = read("src/lib/i18n/translations.ts");
  const spaceDashboardDrawer = read("src/components/spaces/space-dashboard-drawer.tsx");

  assert.doesNotMatch(translations, /delivery movement/);
  assert.doesNotMatch(translations, /stale campaigns/);
  assert.doesNotMatch(read("src/app/api/dashboard/summary/route.ts"), /stale activity/);
  assert.doesNotMatch(translations, /campanhas paradas/);
  assert.match(translations, /Overdue tasks or no activity in 7 days/);
  assert.match(translations, /Clients with overdue work, missing setup, or no recent activity/);
  assert.match(translations, /No open assigned tasks behind this workload signal/);
  assert.match(translations, /overdue open tasks, no owner, or no activity record in 7 days/);
  assert.match(spaceDashboardDrawer, /t\("spaceDashboard\.projectsAtRiskHint"\)/);
});
