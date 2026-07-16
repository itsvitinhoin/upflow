import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildFolderBreadcrumb,
  getSidebarStorageKeys,
} from "../../src/lib/sidebar-discovery";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("sidebar persistence is isolated by both workspace and user", () => {
  const first = getSidebarStorageKeys({ workspaceId: "workspace-a", userId: "user-a" });
  const otherWorkspace = getSidebarStorageKeys({
    workspaceId: "workspace-b",
    userId: "user-a",
  });
  const otherUser = getSidebarStorageKeys({ workspaceId: "workspace-a", userId: "user-b" });

  assert.notEqual(first.collapsed, otherWorkspace.collapsed);
  assert.notEqual(first.collapsed, otherUser.collapsed);
  assert.notEqual(first.snapshot, otherWorkspace.snapshot);
  assert.match(first.collapsed, /workspace-a\.user-a$/);
  assert.match(first.snapshot, /workspace-a\.user-a$/);
});

test("folder breadcrumbs include every ancestor and stop on malformed cycles", () => {
  const folders = new Map([
    ["root", { id: "root", name: "Campaigns", parent_id: null }],
    ["child", { id: "child", name: "Paid Media", parent_id: "root" }],
    ["leaf", { id: "leaf", name: "Launch", parent_id: "child" }],
  ]);
  assert.deepEqual(buildFolderBreadcrumb("leaf", folders), [
    "Campaigns",
    "Paid Media",
    "Launch",
  ]);

  const cyclic = new Map([
    ["a", { id: "a", name: "A", parent_id: "b" }],
    ["b", { id: "b", name: "B", parent_id: "a" }],
  ]);
  assert.deepEqual(buildFolderBreadcrumb("a", cyclic), ["B", "A"]);
});

test("sidebar search is flat, breadcrumbed, and excludes onboarding projects", () => {
  const route = read("src/app/api/sidebar/route.ts");
  const panel = read("src/components/layout/sidebar/panel.tsx");
  const dataHook = read("src/components/layout/sidebar/use-panel-data.ts");

  assert.match(route, /kind:\s*\{\s*not:\s*"onboarding"/);
  assert.match(route, /search_results:\s*searchResults/);
  assert.match(route, /buildFolderBreadcrumb\(project\.folder_id, folderById\)/);
  assert.match(panel, /<SidebarSearchResults/);
  assert.doesNotMatch(panel, /isSearching && visibleTree/);
  assert.match(panel, /sidebar\.searchSpacesAndProjects/);
  assert.match(dataHook, /getSidebarStorageKeys/);
  assert.match(dataHook, /if \(next\[space\.id\] === undefined\) next\[space\.id\] = true/);
});

test("command palette searches the server and preserves project context", () => {
  const palette = read("src/components/command-palette.tsx");
  const searchRoute = read("src/app/api/search/route.ts");

  assert.match(palette, /setTimeout\(\(\) => \{/);
  assert.match(palette, /\/api\/search\?q=/);
  assert.doesNotMatch(palette, /fetch\("\/api\/projects"\)/);
  assert.doesNotMatch(palette, /fetch\("\/api\/spaces"\)/);
  assert.doesNotMatch(palette, /fetch\("\/api\/tasks\?mine=true"\)/);
  assert.match(palette, /go\(`\/spaces\/\$\{space\.id\}`\)/);
  assert.match(palette, /project\.kind === "onboarding"/);
  assert.match(palette, /value=\{`project:\$\{project\.name\}:\$\{context\}/);
  assert.match(palette, /task\.project\?\.name/);
  assert.match(palette, /doc\.project\?\.name/);
  const searchPage = read("src/app/(dashboard)/search/page.tsx");
  assert.match(searchPage, /new AbortController\(\)/);
  assert.match(searchPage, /controller\.abort\(\)/);
  assert.match(searchPage, /setData\(null\)/);
  assert.match(searchPage, /setLoading\(false\)/);
  assert.match(searchRoute, /company:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true/);
  assert.match(searchRoute, /folder:\s*\{\s*select:/);
  assert.match(searchRoute, /prisma\.space\.findMany/);
  assert.doesNotMatch(searchRoute, /kind:\s*\{\s*not:\s*"onboarding"/);
});
