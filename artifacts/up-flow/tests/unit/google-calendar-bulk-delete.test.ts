import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("bulk calendar-event deletion preserves provider tombstones before deleting local events", () => {
  const helper = read("src/lib/calendar-event-delete.ts");

  assert.match(helper, /queueGoogleCalendarEventDeletionInTransaction\(tx, eventId\)/);
  assert.match(
    helper,
    /googleCalendarSyncJob\.deleteMany\(\{[\s\S]*?event_id: \{ in: eventIds \},[\s\S]*?operation: "upsert"/,
  );
  assert.match(helper, /calendarEvent\.deleteMany\(\{[\s\S]*?id: \{ in: eventIds \}/);

  const queueIndex = helper.indexOf("queueGoogleCalendarEventDeletionInTransaction(tx, eventId)");
  const upsertRemovalIndex = helper.indexOf("tx.googleCalendarSyncJob.deleteMany");
  const localDeleteIndex = helper.indexOf("tx.calendarEvent.deleteMany");
  assert.ok(
    queueIndex < upsertRemovalIndex && upsertRemovalIndex < localDeleteIndex,
    "queue deletion tombstones, then discard all upserts, then delete local events",
  );
});

test("project and task lifecycle deletions use the tombstone-aware bulk helper", () => {
  const taskDelete = read("src/lib/task-delete.ts");
  const projectDelete = read("src/lib/project-delete.ts");

  for (const source of [taskDelete, projectDelete]) {
    assert.match(source, /deleteCalendarEventsWithGoogleTombstones/);
  }

  assert.match(taskDelete, /task_id: \{ in: allTaskIds \}/);
  assert.match(projectDelete, /project_id: \{ in: projectIds \}/);
  assert.doesNotMatch(taskDelete, /calendarEvent\.deleteMany/);
  assert.doesNotMatch(projectDelete, /calendarEvent\.deleteMany/);
});

test("QA reset paths use the same deletion-safe calendar-event helper", () => {
  const workspaceReset = read("src/app/api/workspaces/[id]/reset-test-data/route.ts");
  const testerReset = read("src/app/api/testers/reset/route.ts");

  assert.match(workspaceReset, /deleteCalendarEventsWithGoogleTombstones\(tx, \{[\s\S]*?workspace_id: workspace\.id/);
  assert.match(testerReset, /deleteCalendarEventsWithGoogleTombstones\(tx, \{ created_by: userId \}\)/);
  assert.doesNotMatch(workspaceReset, /calendarEvent\.deleteMany/);
  assert.doesNotMatch(testerReset, /calendarEvent\.deleteMany/);
});
