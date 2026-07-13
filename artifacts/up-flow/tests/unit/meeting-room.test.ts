import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("meeting room section is exposed in navigation and books the shared room", () => {
  const rail = read("src/components/layout/sidebar/rail.tsx");
  const page = read("src/app/(dashboard)/sala-de-reuniao/page.tsx");
  const calendarPage = read("src/app/(dashboard)/calendar/page.tsx");
  const scheduleDialog = read("src/components/dashboard/schedule-meeting-dialog.tsx");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(rail, /href: "\/sala-de-reuniao"/);
  assert.match(rail, /labelKey: "nav\.meetingRoom"/);
  assert.match(page, /ROOM_NAME = "Sala de Reuniao"/);
  assert.match(page, /DAY_CELL_VISIBLE_ITEM_LIMIT = 8/);
  assert.match(page, /defaultLocation=\{ROOM_NAME\}/);
  assert.match(page, /filter\(isMeetingRoomEvent\)/);
  assert.match(page, /eventUserIds/);
  assert.match(page, /selectedUserId/);
  assert.match(page, /conflictIds\(filteredEvents\)/);
  assert.match(page, /handleDelete/);
  assert.match(page, /api\/calendar\/events\/\$\{event\.id\}/);
  assert.match(page, /<Trash2/);
  assert.match(page, /meetingRoom\.userFilter/);
  assert.match(scheduleDialog, /defaultLocation\?: string \| null/);
  assert.match(scheduleDialog, /roomBooking\?: boolean/);
  assert.match(scheduleDialog, /roomAttendeeOptions/);
  assert.match(scheduleDialog, /toggleAttendee/);
  assert.match(scheduleDialog, /type="checkbox"/);
  assert.match(scheduleDialog, /meetingRoom\.chooseParticipants/);
  assert.match(scheduleDialog, /meetingRoom\.bookingType/);
  assert.match(scheduleDialog, /const resolvedLocation = roomBooking \? defaultLocation \|\| "Sala de Reuniao" : defaultLocation/);
  assert.match(scheduleDialog, /\.\.\.\(resolvedLocation \? \{ location: resolvedLocation \} : \{\}\)/);
  assert.match(calendarPage, /ROOM_BOOKING_COLOR/);
  assert.match(calendarPage, /isMeetingRoomEvent/);
  assert.match(calendarPage, /calendar\.roomBooking/);
  assert.match(calendarPage, /calendar\.legendRoomBooking/);
  assert.match(translations, /"nav\.meetingRoom": "Meeting room"/);
  assert.match(translations, /"nav\.meetingRoom": "Sala de Reuniao"/);
  assert.match(translations, /"meetingRoom\.reserveRoom": "Reserve room"/);
  assert.match(translations, /"meetingRoom\.allUsers": "All users"/);
  assert.match(translations, /"meetingRoom\.roomReserved": "Meeting room reserved"/);
  assert.match(translations, /"meetingRoom\.chooseParticipants": "Choose participants for the room booking\."/);
  assert.match(translations, /"calendar\.legendRoomBooking": "Meeting room booking"/);
});
