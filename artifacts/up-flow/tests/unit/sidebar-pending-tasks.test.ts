import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  addProjectPendingTodoCounts,
  countPendingTodoTasks,
} from "../../src/lib/sidebar-pending-tasks";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("sums pending To Do tasks across a space's visible projects", () => {
  const count = countPendingTodoTasks([
    { _count: { tasks: 3 } },
    { _count: { tasks: 0 } },
    { _count: { tasks: 7 } },
  ]);

  assert.equal(count, 10);
});

test("returns zero when a space has no visible projects with To Do tasks", () => {
  assert.equal(countPendingTodoTasks([]), 0);
});

test("adds each list's pending To Do task count without changing its task total", () => {
  const projects = addProjectPendingTodoCounts(
    [
      { id: "project-a", _count: { tasks: 8 } },
      { id: "project-b", _count: { tasks: 4 } },
    ],
    [{ project_id: "project-b", _count: { _all: 3 } }],
  );

  assert.deepEqual(projects, [
    { id: "project-a", _count: { tasks: 8 }, pending_todo_count: 0 },
    { id: "project-b", _count: { tasks: 4 }, pending_todo_count: 3 },
  ]);
});

test("the sidebar returns and refreshes pending To Do workload counts", () => {
  const route = read("src/app/api/sidebar/route.ts");
  const tree = read("src/components/layout/sidebar/space-tree.tsx");
  const projectRow = read("src/components/layout/sidebar/project-row.tsx");
  const panelData = read("src/components/layout/sidebar/use-panel-data.ts");

  assert.match(route, /tasks: \{ where: \{ status: "todo" as const \} \}/);
  assert.match(route, /pending_todo_count/);
  assert.match(route, /prisma\.task\.groupBy/);
  assert.match(route, /addProjectPendingTodoCounts/);
  assert.match(tree, /pending_todo_count/);
  assert.match(tree, /sidebar\.pendingTodoCount/);
  assert.match(projectRow, /project\.pending_todo_count/);
  assert.match(projectRow, /sidebar\.pendingTodoCount/);
  assert.match(panelData, /WORKLOAD_REFRESH_INTERVAL_MS = 30_000/);
  assert.match(panelData, /activeQueryRef\.current/);
});
