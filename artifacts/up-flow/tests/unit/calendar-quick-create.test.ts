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
  assert.match(page, /calendar\.quickCreateShort/);
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
  assert.match(translations, /"calendar.quickCreateShort"/);
  assert.match(translations, /"calendar.quickEvent"/);
  assert.match(translations, /"calendar.quickTask"/);
  assert.match(translations, /"calendar.eventDetailsPlaceholder"/);
});

test("calendar events expose edit and completion color controls", () => {
  const page = source("src/app/(dashboard)/calendar/page.tsx");
  const api = source("src/app/api/calendar/events/[id]/route.ts");
  const translations = source("src/lib/i18n/translations.ts");

  assert.match(page, /COMPLETED_EVENT_COLOR/);
  assert.match(page, /eventIsComplete/);
  assert.match(page, /eventHasEnded/);
  assert.match(page, /eventDisplayState/);
  assert.match(page, /isAutoComplete/);
  assert.match(page, /isComplete \? COMPLETED_EVENT_COLOR : eventColor\(event\)/);
  assert.match(page, /openEventMenu/);
  assert.match(page, /onContextMenu=\{\(e\) => openEventMenu\(event, e\)\}/);
  assert.match(page, /onClick=\{\(\) => setEditingEvent\(event\)\}/);
  assert.match(page, /setEditingEvent\(event\)/);
  assert.match(page, /updateEventColor\(event, COMPLETED_EVENT_COLOR\)/);
  assert.match(page, /setSelected\(new Date\(event\.starts_at\)\)/);
  assert.match(page, /calendar\.markComplete/);
  assert.match(page, /calendar\.autoCompleted/);
  assert.match(page, /calendar\.changeColor/);
  assert.match(page, /calendar\.legendCompletedEvent/);

  assert.match(api, /color: z\.string\(\)\.trim\(\)\.optional\(\)\.nullable\(\)/);
  assert.match(api, /body\.color !== undefined/);

  assert.match(translations, /"calendar.markComplete"/);
  assert.match(translations, /"calendar.editEvent"/);
  assert.match(translations, /"calendar.autoCompleted"/);
  assert.match(translations, /"calendar.colorComplete"/);
  assert.match(translations, /"calendar.legendCompletedEvent"/);
});

test("calendar month cells support dense event days without a two-item cap", () => {
  const page = source("src/app/(dashboard)/calendar/page.tsx");

  assert.match(page, /DAY_CELL_VISIBLE_ITEM_LIMIT = 6/);
  assert.match(page, /data-calendar-day-items/);
  assert.match(page, /visibleDayEvents\.map/);
  assert.match(page, /visibleDayTasks\.map/);
  assert.match(page, /hiddenDayItems > 0/);
  assert.match(page, /calendar\.more/);
  assert.doesNotMatch(page, /dayEvents\.slice\(0,\s*2\)/);
  assert.doesNotMatch(page, /dayTasks\.slice\(0,\s*2\)/);
});
