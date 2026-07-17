import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..", "src", "app", "api");

const routes = [
  "calendar/events/[id]/route.ts",
  "projects/[id]/reorder-tasks/route.ts",
  "tasks/[id]/custom-fields/route.ts",
  "workspaces/[id]/departments/route.ts",
];

test("dynamic API routes await Next 15 params", () => {
  for (const route of routes) {
    const source = readFileSync(join(ROOT, route), "utf8");
    assert.match(source, /type RouteContext = \{ params: Promise<\{ id: string \}> \}/);
    assert.match(source, /await params/);
    assert.doesNotMatch(source, /params\.id/);
  }
});
