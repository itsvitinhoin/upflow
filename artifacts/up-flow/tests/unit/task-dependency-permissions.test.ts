import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("task dependency mutations require current project contributor access", () => {
  const createRoute = read("src/app/api/tasks/[id]/dependencies/route.ts");
  const deleteRoute = read(
    "src/app/api/tasks/[id]/dependencies/[dependencyId]/route.ts",
  );

  for (const route of [createRoute, deleteRoute]) {
    assert.match(route, /import \{ canContributeToProject \} from "@\/lib\/project-access"/);
    assert.match(route, /await canContributeToProject\(auth, (?:task|dependency\.task)\.project\)/);
    assert.doesNotMatch(route, /isWorkspaceAdminFor/);
    assert.doesNotMatch(route, /assignee_id === auth\.prismaUser\.id/);
  }
});
