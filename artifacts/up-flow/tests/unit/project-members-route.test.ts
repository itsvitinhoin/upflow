import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("project member routes expose eligible people and protect membership changes", () => {
  const membersRoute = read("src/app/api/projects/[id]/members/route.ts");
  const memberRoute = read("src/app/api/projects/[id]/members/[userId]/route.ts");

  assert.match(membersRoute, /canReadProject\(auth, project\)/);
  assert.match(membersRoute, /canManageProjectMembers/);
  assert.match(membersRoute, /canManageMembers,/);
  assert.match(membersRoute, /const canManageMembers = canManageProjectMembers\(auth, project\)/);
  assert.match(membersRoute, /canManageMembers\s*\?\s*prisma\.workspaceMember\.findMany/);
  assert.match(membersRoute, /eligibleMembers:/);
  assert.match(membersRoute, /status:\s*"active"/);
  assert.match(membersRoute, /role:\s*\{\s*not:\s*"guest"\s*\}/);
  assert.match(membersRoute, /project_id_user_id/);
  assert.match(membersRoute, /project\.owner_id === parsed\.data\.user_id/);
  assert.match(membersRoute, /recordActivity\(/);
  assert.match(membersRoute, /export const POST = withErrorReporting/);

  assert.match(memberRoute, /canReadProject\(auth, project\)/);
  assert.match(memberRoute, /canManageProjectMembers/);
  assert.match(memberRoute, /project\.owner_id === parsedUserId\.data/);
  assert.match(memberRoute, /projectMember\.deleteMany/);
  assert.match(memberRoute, /recordActivity\(/);
  assert.match(memberRoute, /export const DELETE = withErrorReporting/);
});
