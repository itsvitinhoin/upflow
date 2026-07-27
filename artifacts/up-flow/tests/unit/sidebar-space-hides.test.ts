import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("Space hides are a private, durable preference rather than a workspace-wide flag", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read(
    "prisma/migrations/20260727140000_add_user_sidebar_space_hides/migration.sql",
  );

  assert.match(schema, /model SidebarSpaceHide/);
  assert.match(schema, /sidebar_space_hides\s+SidebarSpaceHide\[\]/);
  assert.match(schema, /@@unique\(\[workspace_id, user_id, space_id\]\)/);
  assert.match(
    schema,
    /workspace\s+Workspace @relation\(fields: \[workspace_id\]/,
  );
  assert.match(schema, /user\s+User\s+@relation\(fields: \[user_id\]/);
  assert.match(schema, /space\s+Space\s+@relation\(fields: \[space_id\]/);
  assert.match(migration, /CREATE TABLE "SidebarSpaceHide"/);
  assert.match(migration, /SidebarSpaceHide_workspace_id_user_id_space_id_key/);
  assert.match(migration, /ON DELETE CASCADE ON UPDATE CASCADE/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(
    migration,
    /REVOKE ALL ON TABLE "SidebarSpaceHide" FROM anon, authenticated/,
  );
});

test("hide and restore APIs are limited to the signed-in user and workspace", () => {
  const route = read("src/app/api/my-space-hides/[spaceId]/route.ts");

  assert.match(route, /requireAuth\(\)/);
  assert.match(route, /SpaceIdSchema = z\.string\(\)\.uuid\(\)/);
  assert.match(route, /prisma\.space\.findFirst/);
  assert.match(route, /workspace_id: auth\.currentWorkspaceId/);
  assert.match(route, /user_id: auth\.prismaUser\.id/);
  assert.match(route, /prisma\.sidebarSpaceHide\.upsert/);
  assert.match(route, /prisma\.sidebarSpaceHide\.deleteMany/);
  assert.match(route, /workspace_id_user_id_space_id/);
});

test("hidden Spaces cannot reappear through sidebar navigation or search", () => {
  const sidebarRoute = read("src/app/api/sidebar/route.ts");
  const panelData = read("src/components/layout/sidebar/use-panel-data.ts");

  assert.match(sidebarRoute, /prisma\.sidebarSpaceHide\.findMany/);
  assert.match(sidebarRoute, /const hiddenSpaceIds = hiddenSpaces\.map/);
  assert.match(
    sidebarRoute,
    /const personalSpaceVisibilityWhere: Prisma\.ProjectWhereInput/,
  );
  assert.match(sidebarRoute, /id: \{ notIn: hiddenSpaceIds \}/);
  assert.match(sidebarRoute, /space_id: \{ notIn: hiddenSpaceIds \}/);
  assert.match(sidebarRoute, /hidden_spaces: hiddenSpaces/);
  assert.match(panelData, /hidden_spaces\?: SidebarHiddenSpace\[\]/);
  assert.match(panelData, /setHiddenSpaces\(data\.hidden_spaces \?\? \[\]\)/);
});

test("every member can hide a Space and can restore it from the sidebar", () => {
  const panel = read("src/components/layout/sidebar/panel.tsx");
  const tree = read("src/components/layout/sidebar/space-tree.tsx");
  const spaceNode = tree.slice(
    tree.indexOf("export function SpaceNode"),
    tree.indexOf("export function FolderNode"),
  );

  assert.match(
    spaceNode,
    /<EyeOff className="w-3 h-3"\s*\/?> \{t\("sidebar\.hideSpace"\)\}/,
  );
  assert.doesNotMatch(
    spaceNode,
    /\{canManageWorkspace && \(\s*<div\s+className="relative z-20 flex flex-shrink-0 items-center"/,
  );
  assert.match(
    panel,
    /fetch\(`\/api\/my-space-hides\/\$\{sp\.id\}`,\s*\{\s*method: "POST",?\s*\}\s*\)/,
  );
  assert.match(
    panel,
    /fetch\(`\/api\/my-space-hides\/\$\{space\.id\}`,\s*\{\s*method: "DELETE",?\s*\}\s*\)/,
  );
  assert.match(panel, /<HiddenSpacesSection/);
  assert.match(
    panel,
    /t\("sidebar\.hiddenSpaces", \{ count: items\.length \}\)/,
  );
  assert.match(panel, /t\("sidebar\.restoreSpace"\)/);
});
