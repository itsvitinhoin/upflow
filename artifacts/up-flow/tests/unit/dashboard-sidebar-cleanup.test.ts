import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("home dashboard defaults to a focused today and risks command center", () => {
  const page = read("src/app/(dashboard)/page.tsx");
  const agencyPanel = read("src/components/dashboard/agency-operations-panel.tsx");

  assert.match(page, /t\("dashboard\.commandCenter"\)/);
  assert.match(page, /TodayFocusPanel/);
  assert.match(page, /QuickCreateMenu/);
  assert.match(page, /StatusCountButton/);
  assert.match(page, /<TeamTimeline\s/);
  assert.match(page, /agency-operations-panel/);
  assert.match(agencyPanel, /Client work, delivery, creative queue, and workload/);
  assert.match(page, /\/api\/dashboard\/summary/);
  assert.doesNotMatch(page, /function AgencyOperationsPanel/);
  assert.doesNotMatch(page, /<RightPanel\s/);
  assert.doesNotMatch(page, /<QuickAction\s/);
  assert.doesNotMatch(page, /<StatCard\s/);
  assert.doesNotMatch(page, /<PeopleCard\s/);
});

test("desktop sidebar exposes a clear sliding drawer toggle", () => {
  const sidebar = read("src/components/layout/sidebar.tsx");
  const rail = read("src/components/layout/sidebar/rail.tsx");
  const panel = read("src/components/layout/sidebar/panel.tsx");

  assert.match(sidebar, /transition-\[width,opacity\]/);
  assert.match(sidebar, /aria-hidden=\{!panelOpen\}/);
  assert.match(sidebar, /onRequestClose=\{\(\) => setPanelOpen\(false\)\}/);
  assert.match(rail, /sidebar\.show/);
  assert.match(rail, /sidebar\.hide/);
  assert.match(rail, /aria-pressed=\{panelOpen\}/);
  assert.match(panel, /sidebar\.hide/);
  assert.match(panel, /PanelLeftClose/);
});
