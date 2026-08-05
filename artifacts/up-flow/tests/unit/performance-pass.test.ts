import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("defers optional Space and sidebar UI while preserving the existing panel behavior", () => {
  const sidebar = source("src/components/layout/sidebar.tsx");
  const panelData = source("src/components/layout/sidebar/use-panel-data.ts");
  const spacePage = source("src/app/(dashboard)/spaces/[id]/page.tsx");

  assert.match(sidebar, /const Panel = dynamic/);
  assert.match(sidebar, /active=\{panelOpen\}/);
  assert.match(panelData, /options: \{ enabled\?: boolean \} = \{\}/);
  assert.match(panelData, /if \(!enabled\) return;/);
  assert.match(panelData, /panelCache\.delete\(storageKeys\.scope\)/);
  assert.match(spacePage, /const SpaceDocsTab = dynamic/);
  assert.match(spacePage, /ssr: false/);
});

test("calendar and document indexes request only the data their list views use", () => {
  const calendarPage = source("src/app/(dashboard)/calendar/page.tsx");
  const taskRoute = source("src/app/api/tasks/route.ts");
  const eventRoute = source("src/app/api/calendar/events/route.ts");
  const eventDetail = source("src/app/api/calendar/events/event-detail.ts");
  const docsRoute = source("src/app/api/docs/route.ts");
  const docsPage = source("src/app/(dashboard)/docs/page.tsx");
  const companiesRoute = source("src/app/api/companies/route.ts");
  const clientsPage = source("src/app/(dashboard)/clients/page.tsx");
  const [docsListHandler] = docsRoute.split("async function POST_handler");

  assert.match(calendarPage, /new URLSearchParams\(\{ due_from: from, due_to: to \}\)/);
  assert.match(calendarPage, /\/api\/tasks\?\$\{taskRangeParams\.toString\(\)\}/);
  assert.match(taskRoute, /const dueFromParam = searchParams\.get\("due_from"\)/);
  assert.match(taskRoute, /where\.due_date = \{/);
  assert.match(eventRoute, /select: calendarEventListSelect/);
  assert.match(eventDetail, /export const calendarEventListSelect/);
  assert.match(docsListHandler, /select: \{/);
  assert.doesNotMatch(docsListHandler, /content:/);
  assert.match(docsPage, /DocSummary/);
  assert.match(companiesRoute, /const includeSummary = url\.searchParams\.get\("include_summary"\) !== "false"/);
  assert.match(companiesRoute, /if \(!includeSummary\)/);
  assert.match(companiesRoute, /include: companyListInclude/);
  assert.match(clientsPage, /params\.set\("include_summary", "false"\)/);
});
