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
