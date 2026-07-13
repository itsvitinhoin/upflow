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

test("auth membership scope ignores inactive workspace members", () => {
  const workspace = read("src/lib/workspace.ts");

  assert.match(workspace, /where:\s*\{\s*user_id: userId,\s*status:\s*"active"\s*\}/);
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

test("workspace data reset is owner-only and preserves access records", () => {
  const route = read("src/app/api/workspaces/[id]/reset-test-data/route.ts");
  const settingsPage = read("src/app/(dashboard)/settings/page.tsx");
  const qaResetPage = read("src/app/(dashboard)/settings/qa-reset/page.tsx");

  assert.match(route, /RESET_CONFIRMATION = "RESET WORKSPACE DATA"/);
  assert.match(route, /qa\|test\|testing\|sandbox\|e2e\|personal/);
  assert.match(route, /Only workspace owners can reset workspace data/);
  assert.match(route, /membership\?\.role !== "owner"/);
  assert.match(route, /membership\.status !== "active"/);
  assert.match(route, /prisma\.\$transaction/);
  assert.match(route, /project\.deleteMany/);
  assert.match(route, /company\.deleteMany/);
  assert.match(route, /space\.deleteMany/);
  assert.match(route, /activityEvent\.create/);
  assert.match(route, /workspace_test_data_reset/);
  assert.doesNotMatch(route, /workspaceMember\.deleteMany/);
  assert.doesNotMatch(route, /workspaceInvite\.deleteMany/);
  assert.match(settingsPage, /\/settings\/qa-reset/);
  assert.match(qaResetPage, /RESET WORKSPACE DATA/);
  assert.match(qaResetPage, /Clean workspace data/);
  assert.match(qaResetPage, /\/api\/workspaces\/\$\{current\.id\}\/reset-test-data/);
});
