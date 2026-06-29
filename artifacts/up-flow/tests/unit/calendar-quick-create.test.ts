import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("calendar selected-day panel exposes quick create actions", () => {
  const page = source("src/app/(dashboard)/calendar/page.tsx");
  const scheduleDialog = source("src/components/dashboard/schedule-meeting-dialog.tsx");
  const taskDialog = source("src/components/projects/new-task-dialog.tsx");
  const translations = source("src/lib/i18n/translations.ts");

  assert.match(page, /quickCreateOpen/);
  assert.match(page, /calendar\.quickCreate/);
  assert.match(page, /openSchedule\("meeting"\)/);
  assert.match(page, /openSchedule\("reminder"\)/);
  assert.match(page, /openTaskDialog/);
  assert.match(page, /<NewTaskDialog/);
  assert.match(page, /defaultDueDate=\{appDateKey\(selected\)\}/);

  assert.match(scheduleDialog, /defaultType = "meeting"/);
  assert.match(scheduleDialog, /type: eventType/);
  assert.match(scheduleDialog, /calendar\.eventScheduled/);
  assert.match(taskDialog, /defaultDueDate\?: string/);

  assert.match(translations, /"calendar.quickMeeting"/);
  assert.match(translations, /"calendar.quickEvent"/);
  assert.match(translations, /"calendar.quickTask"/);
  assert.match(translations, /"calendar.eventDetailsPlaceholder"/);
});
