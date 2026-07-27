import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("department queues remain visible and can be restored without touching client work", () => {
  const sidebarRoute = read("src/app/api/sidebar/route.ts");
  const folderRoute = read("src/app/api/folders/[id]/route.ts");
  const spaceRoute = read("src/app/api/spaces/[id]/route.ts");
  const migration = read(
    "prisma/migrations/20260727120000_restore_department_shared_list_visibility/migration.sql",
  );

  for (const route of [sidebarRoute, folderRoute, spaceRoute]) {
    assert.match(route, /\{ company_id: null \}/);
  }

  for (const listName of [
    "Campaigns",
    "LinkedIn & Outbound",
    "Landing Pages",
    "Reports",
    "Content Calendar",
    "Ads",
    "Promotions",
    "Design Queue",
    "Creative Reviews",
    "Brand Assets",
    "Approvals",
    "Social Media",
  ]) {
    assert.match(migration, new RegExp(`'${listName}'`));
  }

  assert.match(migration, /UPDATE "Project" AS project/);
  assert.match(migration, /INSERT INTO "Project"/);
  assert.match(migration, /project\."company_id" IS NULL/);
  assert.match(migration, /'operational_queue'::"ProjectKind"/);
  assert.match(migration, /WHERE NOT EXISTS/);
  assert.doesNotMatch(migration, /DELETE FROM "Project"/);
});
