import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("ordinary task reordering uses the shared project contributor policy", () => {
  const route = read("src/app/api/projects/[id]/reorder-tasks/route.ts");

  assert.match(route, /import \{ canContributeToProject \} from "@\/lib\/project-access"/);
  assert.match(route, /select: \{ id: true, workspace_id: true, owner_id: true \}/);
  assert.match(route, /const canContribute = await canContributeToProject\(auth, project\)/);
  assert.match(route, /: canContribute;/);
});

test("ordinary project contributors cannot reorder onboarding tasks", () => {
  const route = read("src/app/api/projects/[id]/reorder-tasks/route.ts");

  assert.match(route, /onboardingAccess\?\.canUpdateChecklistItem\(onboardingItem\) && srcColumn !== dstColumn/);
  assert.match(route, /canMoveDepartmentOnboardingTask/);
  assert.match(
    route,
    /const canReorderTask = onboardingItem\s*\? isWorkspaceAdminFor\(auth, project\.workspace_id\) \|\| canMoveDepartmentOnboardingTask\s*: canContribute;/,
  );
  assert.match(route, /if \(!canReorderTask\)/);
});
