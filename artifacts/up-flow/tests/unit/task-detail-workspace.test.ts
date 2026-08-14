import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("task details use an accessible full task hub instead of the right drawer", () => {
  const detail = read("src/components/projects/task-detail-sheet.tsx");

  assert.match(detail, /data-testid="task-detail-workspace"/);
  assert.match(detail, /role="dialog"/);
  assert.match(detail, /aria-modal="true"/);
  assert.match(detail, /aria-label=\{currentTask\.title\}/);
  assert.match(detail, /fixed inset-0 z-50/);
  assert.match(detail, /data-testid="task-detail-main"/);
  assert.match(detail, /data-testid="task-detail-activity"/);
  assert.match(detail, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.doesNotMatch(detail, /fixed right-0 top-0 z-50.*sm:max-w-lg/);
});

test("task hub uses accessible sections with real task and subtask activity", () => {
  const detail = read("src/components/projects/task-detail-sheet.tsx");
  const activityRoute = read("src/app/api/activity/route.ts");

  assert.match(detail, /role="tablist"/);
  assert.match(detail, /role="tab"/);
  assert.match(detail, /role="tabpanel"/);
  assert.match(detail, /include_subtasks=true/);
  assert.match(detail, /activityEventLabel\(event\.type, t\)/);
  assert.match(activityRoute, /includeSubtasks/);
  assert.match(activityRoute, /parent_id: taskId/);
  assert.match(detail, /comments\.map\(\(comment\) =>/);
  assert.match(detail, /taskWorkspace\.quickChecklist/);
  assert.match(detail, /TaskCoverImageControl/);
});

test("task workspace locks focus and keeps nested task controls accessible", () => {
  const detail = read("src/components/projects/task-detail-sheet.tsx");
  const assigneePicker = read("src/components/projects/task-assignee-picker.tsx");

  assert.match(detail, /document\.body\.style\.overflow = "hidden"/);
  assert.match(detail, /event\.key !== "Tab"/);
  assert.match(detail, /event\.key === "Escape"/);
  assert.match(detail, /previouslyFocused\?\.focus\?\.\(\)/);
  assert.match(detail, /getClientRects\(\)\.length > 0/);
  assert.match(detail, /event\.stopPropagation\(\);\s*setReplyingTo\(null\);/);
  assert.match(detail, /taskWorkspace\.taskTitle/);
  assert.match(assigneePicker, /modal\?: boolean/);
  assert.match(assigneePicker, /<Popover\s+modal=\{modal\}/);
});