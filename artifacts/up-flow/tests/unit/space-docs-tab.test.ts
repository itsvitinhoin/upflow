import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("Spaces exposes Docs as a persistent, accessible view", () => {
  const page = read("src/app/(dashboard)/spaces/[id]/page.tsx");
  const types = read("src/components/spaces/space-page-types.ts");
  const tabButton = read("src/components/spaces/space-dashboard-parts.tsx");

  assert.match(types, /"dashboard" \| "browse" \| "docs"/);
  assert.match(page, /tabParam === "docs"/);
  assert.match(page, /<SpaceDocsTab/);
  assert.match(page, /router\.replace/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tabpanel"/);
  assert.match(page, /handleTabKeyDown/);
  assert.match(tabButton, /role="tab"/);
  assert.match(tabButton, /aria-selected=\{active\}/);
  assert.match(tabButton, /tabIndex=\{active \? 0 : -1\}/);
});

test("Space Docs keeps documents scoped to a project in the active Space", () => {
  const docsTab = read("src/components/spaces/space-docs-tab.tsx");
  const route = read("src/app/api/spaces/[id]/docs/route.ts");

  assert.match(docsTab, /data-testid="space-docs-tab"/);
  assert.match(docsTab, /data-testid="space-docs-new"/);
  assert.match(docsTab, /project_id: selectedProjectId/);
  assert.match(docsTab, /<TiptapEditor/);
  assert.match(docsTab, /flushPendingSave/);
  assert.match(docsTab, /pendingSaveRef/);
  assert.match(route, /project:\s*\{\s*is:\s*\{/);
  assert.match(route, /space_id: space\.id/);
  assert.match(route, /project_id required/);
  assert.match(route, /isWorkspaceAdminFor/);
});

test("Space Docs includes localized labels", () => {
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(translations, /"space\.docsTab": "Docs"/);
  assert.match(translations, /"space\.docsTitle": "Space docs"/);
  assert.match(translations, /"space\.docsCreated": "Document created"/);
  assert.equal((translations.match(/"space\.docsTitle":/g) ?? []).length, 2);
  assert.equal((translations.match(/"space\.docsLoadErrorBody":/g) ?? []).length, 2);
});
