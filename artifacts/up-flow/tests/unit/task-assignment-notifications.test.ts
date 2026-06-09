import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("task assignee pickers are scoped to active workspace members", () => {
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");
  const taskSheet = read("src/components/projects/task-detail-sheet.tsx");
  const newTaskDialog = read("src/components/projects/new-task-dialog.tsx");
  const usersRoute = read("src/app/api/users/route.ts");

  assert.match(projectPage, /\/api\/users\?workspace_id=\$\{p\.workspace_id\}&status=active/);
  assert.match(taskSheet, /\/api\/users\?workspace_id=\$\{workspaceId\}&status=active/);
  assert.match(newTaskDialog, /\/api\/users\?workspace_id=\$\{project\.workspace_id\}&status=active/);
  assert.match(usersRoute, /statusFilter/);
  assert.match(usersRoute, /membershipStatus/);
});

test("task assignment validates active members and creates assignment notifications", () => {
  const tasksRoute = read("src/app/api/tasks/route.ts");
  const taskRoute = read("src/app/api/tasks/[id]/route.ts");

  assert.match(tasksRoute, /status:\s*"active"/);
  assert.match(taskRoute, /status:\s*"active"/);
  assert.match(tasksRoute, /type:\s*"assigned"/);
  assert.match(taskRoute, /type:\s*"assigned"/);
  assert.match(tasksRoute, /broadcastNotification\(assignee_id\)/);
  assert.match(taskRoute, /broadcastNotification\(assignee_id\)/);
  assert.match(tasksRoute, /Assignee is not an active member of this workspace/);
  assert.match(taskRoute, /Assignee is not an active member of this workspace/);
});

test("task creation dialog prevents duplicate submits and explains project context", () => {
  const newTaskDialog = read("src/components/projects/new-task-dialog.tsx");

  assert.match(newTaskDialog, /if \(loading\) return/);
  assert.match(newTaskDialog, /Choose the list or campaign where this task belongs/);
  assert.match(newTaskDialog, /No lists are available yet/);
  assert.match(newTaskDialog, /dashboard risk and delivery views/);
  assert.match(newTaskDialog, /projectsLoading/);
});
