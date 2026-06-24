import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("workspace member mutations cannot remove the last active owner", () => {
  const route = read("src/app/api/workspaces/[id]/members/[memberId]/route.ts");

  assert.match(route, /hasOtherActiveOwner/);
  assert.match(route, /role:\s*"owner"/);
  assert.match(route, /status:\s*"active"/);
  assert.match(route, /ownerWouldLoseAccess/);
  assert.match(route, /You cannot leave this workspace without an active owner/);
});

test("workspace deletion is owner-only and protects the user's only workspace", () => {
  const route = read("src/app/api/workspaces/[id]/route.ts");

  assert.match(route, /export const DELETE = withErrorReporting\("api:workspaces\/id:DELETE"/);
  assert.match(route, /isSuperAdmin/);
  assert.match(route, /membership\?\.role !== "owner"/);
  assert.match(route, /membership\.status !== "active"/);
  assert.match(route, /activeWorkspaceCount <= 1/);
  assert.match(route, /Create another workspace before deleting your only workspace/);
  assert.match(route, /prisma\.workspace\.delete/);
  assert.match(route, /WORKSPACE_COOKIE/);
});
