import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("calendar events use the full management sheet instead of the quick editor", () => {
  const page = source("src/app/(dashboard)/calendar/page.tsx");
  const editor = source("src/components/calendar/event-editor-sheet.tsx");

  assert.match(page, /import EventEditorSheet/);
  assert.match(page, /<EventEditorSheet/);
  assert.doesNotMatch(page, /function EventEditor\(/);

  assert.match(editor, /title="Event information"/);
  assert.match(editor, /label="Event title"/);
  assert.match(editor, /label="Description \/ notes"/);
  assert.match(editor, /id="event-start-date"/);
  assert.match(editor, /id="event-start-time"/);
  assert.match(editor, /id="event-end-date"/);
  assert.match(editor, /id="event-end-time"/);
  assert.match(editor, /label="Location \/ meeting room"/);
  assert.match(editor, /endsAt <= startsAt/);
});

test("calendar event editor persists participants, relations, reminders, attachments, and lifecycle actions", () => {
  const editor = source("src/components/calendar/event-editor-sheet.tsx");
  const eventApi = source("src/app/api/calendar/events/[id]/route.ts");
  const collectionApi = source("src/app/api/calendar/events/route.ts");
  const schema = source("prisma/schema.prisma");

  assert.match(editor, /title="Participants"/);
  assert.match(editor, /label="Responsible person"/);
  assert.match(editor, /Search workspace members/);
  assert.match(editor, /title="Event settings"/);
  assert.match(editor, /title="Related work"/);
  assert.match(editor, /title="Notifications"/);
  assert.match(editor, /5 minutes before/);
  assert.match(editor, /Custom reminder minutes/);
  assert.match(editor, /Add file/);
  assert.match(editor, /Add link/);
  assert.match(editor, /Attach document/);
  assert.match(editor, /\/duplicate/);
  assert.match(editor, /\/cancel/);
  assert.match(editor, /Delete event/);
  assert.match(editor, /reminder_minutes: reminderMinutes/);
  assert.match(editor, /responsible_user_id: responsibleUserId/);
  assert.match(editor, /company_id: companyId/);
  assert.match(editor, /project_id: projectId/);
  assert.match(editor, /space_id: spaceId/);

  assert.match(collectionApi, /client_call/);
  assert.match(collectionApi, /internal_meeting/);
  assert.match(collectionApi, /validateCalendarEventRelations/);
  assert.match(eventApi, /responsible_user_id/);
  assert.match(eventApi, /reminder_minutes/);
  assert.match(eventApi, /space_id/);
  assert.match(schema, /model CalendarEventReminder/);
  assert.match(schema, /model CalendarEventAttachment/);
  assert.match(schema, /enum CalendarEventStatus/);
});
