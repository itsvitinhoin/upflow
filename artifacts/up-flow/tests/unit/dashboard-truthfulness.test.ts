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
  const spaceDashboard = read("src/app/(dashboard)/spaces/[id]/page.tsx");

  for (const route of [summaryRoute, legacyRoute, spaceRoute]) {
    assert.match(route, /tasks:\s*assignedOpenTasks\.slice\(0, 8\)/);
  }

  assert.match(homeDashboard, /t\("dashboard\.noWorkloadTasks"\)/);
  assert.match(homeDashboard, /item\.tasks\.map/);
  assert.match(spaceDashboard, /No open assigned tasks behind this workload signal/);
  assert.match(spaceDashboard, /item\.tasks\.map/);
});

test("dashboard copy avoids unsupported operational claims", () => {
  const languageProvider = read("src/components/language-provider.tsx");
  const spacePage = read("src/app/(dashboard)/spaces/[id]/page.tsx");

  assert.doesNotMatch(languageProvider, /delivery movement/);
  assert.doesNotMatch(languageProvider, /stale campaigns/);
  assert.doesNotMatch(read("src/app/api/dashboard/summary/route.ts"), /stale activity/);
  assert.doesNotMatch(languageProvider, /campanhas paradas/);
  assert.match(languageProvider, /Overdue tasks or no activity in 7 days/);
  assert.match(languageProvider, /Clients with overdue work, missing setup, or no recent activity/);
  assert.match(spacePage, /overdue open tasks, no owner, or no activity record in 7 days/);
});
