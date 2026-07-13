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
  const scheduleDialog = read("src/components/dashboard/schedule-meeting-dialog.tsx");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(rail, /href: "\/sala-de-reuniao"/);
  assert.match(rail, /labelKey: "nav\.meetingRoom"/);
  assert.match(page, /ROOM_NAME = "Sala de Reuniao"/);
  assert.match(page, /defaultLocation=\{ROOM_NAME\}/);
  assert.match(page, /filter\(isMeetingRoomEvent\)/);
  assert.match(page, /conflictIds\(events\)/);
  assert.match(scheduleDialog, /defaultLocation\?: string \| null/);
  assert.match(scheduleDialog, /\.\.\.\(defaultLocation \? \{ location: defaultLocation \} : \{\}\)/);
  assert.match(translations, /"nav\.meetingRoom": "Meeting room"/);
  assert.match(translations, /"nav\.meetingRoom": "Sala de Reuniao"/);
  assert.match(translations, /"meetingRoom\.reserveRoom": "Reserve room"/);
});
