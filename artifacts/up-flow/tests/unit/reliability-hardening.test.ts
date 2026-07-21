import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..", "src");

function source(path: string) {
  return readFileSync(join(SRC, path), "utf8");
}

test("project creation rejects mismatched folder and space targets", () => {
  const route = source("app/api/projects/route.ts");

  assert.match(route, /Folder does not belong to selected space/);
  assert.match(route, /resolvedSpaceId\s*=\s*folder\.space_id/);
});

test("create operations write activity records for traceability", () => {
  const spaces = source("app/api/spaces/route.ts");
  const projects = source("app/api/projects/route.ts");
  const tasks = source("app/api/tasks/route.ts");

  assert.match(spaces, /type:\s*"space_created"/);
  assert.match(projects, /type:\s*"project_created"/);
  assert.match(tasks, /type:\s*"task_created"/);
});

test("task save does not fail just because realtime notification broadcast fails", () => {
  const createRoute = source("app/api/tasks/route.ts");
  const updateRoute = source("app/api/tasks/[id]/route.ts");
  const assignmentNotifier = source("lib/task-assignment-notifications.ts");

  assert.match(createRoute, /notifyTaskAssignee\(/);
  assert.match(updateRoute, /notifyTaskAssignee\(/);
  assert.match(assignmentNotifier, /await broadcastNotification\(input\.userId\);/);
  assert.match(assignmentNotifier, /catch \(error\)/);
  assert.match(updateRoute, /broadcastNotification\(userId\)\.catch/);
});

test("comment posting does not wait for an optional realtime broadcast", () => {
  const commentsRoute = source("app/api/comments/route.ts");

  assert.match(commentsRoute, /void broadcastNotification\(recipientId\)/);
  assert.doesNotMatch(commentsRoute, /await Promise\.all\([\s\S]*notificationRecipients/);
});

test("sidebar create dialogs refresh navigation and open newly created lists", () => {
  const dialogs = source("components/layout/sidebar/dialogs.tsx");

  assert.match(dialogs, /new CustomEvent\("upflow:sidebar-refresh"\)/);
  assert.match(dialogs, /router\.push\(`\/projects\/\$\{created\.id\}`\)/);
  assert.match(dialogs, /readApiError/);
});
