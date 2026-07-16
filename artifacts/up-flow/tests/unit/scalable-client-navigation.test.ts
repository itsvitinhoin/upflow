import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("generated client onboarding work is hidden without deleting or reparenting it", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260716160000_scalable_client_navigation/migration.sql");
  const onboarding = read("src/lib/onboarding.ts");

  assert.match(schema, /sidebar_hidden\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /model SidebarClientPin/);
  assert.match(schema, /@@unique\(\[workspace_id, user_id, company_id\]\)/);
  assert.match(migration, /project\."company_id" IS NOT NULL/);
  assert.match(migration, /OnboardingChecklistItem/);
  assert.match(migration, /AND NOT EXISTS \(\s*SELECT 1\s*FROM "Project"/);
  assert.doesNotMatch(migration, /DELETE FROM "Project"/);
  assert.doesNotMatch(migration, /DELETE FROM "Folder"/);
  assert.match(onboarding, /sidebarHidden: true/);
  assert.match(onboarding, /sidebar_hidden: true/);
});

test("the sidebar hides generated branches by default but search keeps client work discoverable", () => {
  const sidebarRoute = read("src/app/api/sidebar/route.ts");
  const panel = read("src/components/layout/sidebar/panel.tsx");
  const panelData = read("src/components/layout/sidebar/use-panel-data.ts");

  assert.match(sidebarRoute, /AND: \[readableProjectsWhere, \{ sidebar_hidden: false \}\]/);
  assert.match(sidebarRoute, /sidebar_hidden: false/);
  assert.match(sidebarRoute, /company: \{ is: \{ name: \{ contains: q/);
  assert.match(sidebarRoute, /pinned_clients: pinnedClients/);
  assert.match(panelData, /pinned_clients\?: SidebarPinnedClient\[\]/);
  assert.match(panel, /PinnedClientsSection/);
  assert.match(panel, /\/api\/sidebar-pins\/\$\{companyId\}/);
});

test("client pins are private, workspace-scoped, and capped at five", () => {
  const pins = read("src/app/api/sidebar-pins/route.ts");
  const removePin = read("src/app/api/sidebar-pins/[companyId]/route.ts");
  const pinButton = read("src/components/clients/client-pin-button.tsx");

  assert.match(pins, /MAX_SIDEBAR_CLIENT_PINS = 5/);
  assert.match(pins, /workspace_id: auth\.currentWorkspaceId/);
  assert.match(pins, /user_id: auth\.prismaUser\.id/);
  assert.match(pins, /count >= MAX_SIDEBAR_CLIENT_PINS/);
  assert.match(removePin, /workspace_id: auth\.currentWorkspaceId/);
  assert.match(removePin, /user_id: auth\.prismaUser\.id/);
  assert.match(pinButton, /window\.dispatchEvent\(new CustomEvent\("upflow:sidebar-refresh"\)\)/);
});

test("onboarding and client discovery support lifecycle filtering, search, and direct client results", () => {
  const onboardingRoute = read("src/app/api/onboarding/route.ts");
  const onboardingPage = read("src/app/(dashboard)/onboarding/page.tsx");
  const companiesRoute = read("src/app/api/companies/route.ts");
  const clientsPage = read("src/app/(dashboard)/clients/page.tsx");
  const searchRoute = read("src/app/api/search/route.ts");
  const searchPage = read("src/app/(dashboard)/search/page.tsx");

  assert.match(onboardingRoute, /lifecycle === "completed"/);
  assert.match(onboardingRoute, /lifecycle === "active"/);
  assert.match(onboardingRoute, /checklist_items/);
  assert.match(onboardingPage, /QueueLifecycle/);
  assert.match(onboardingPage, /onboardingQueue\.searchPlaceholder/);
  assert.match(onboardingPage, /ClientPinButton/);
  assert.match(companiesRoute, /const q = \(new URL\(req\.url\)\.searchParams\.get\("q"\)/);
  assert.match(clientsPage, /nextCursor/);
  assert.match(clientsPage, /clients\.loadMore/);
  assert.match(searchRoute, /companies/);
  assert.match(searchPage, /SearchCompany/);
  assert.match(searchPage, /href=\{`\/clients\/\$\{company\.id\}`\}/);
});
