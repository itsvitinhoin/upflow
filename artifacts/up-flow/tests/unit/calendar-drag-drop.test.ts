import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("calendar events can be dragged to another date while preserving their duration", () => {
  const page = source("src/app/(dashboard)/calendar/page.tsx");

  assert.match(page, /draggable/);
  assert.match(page, /onDragStart=\{\(dragEvent\) => startEventDrag\(event, dragEvent\)\}/);
  assert.match(page, /onDrop=\{\(dragEvent\) => dropEventOnDate\(dragEvent, day\)\}/);
  assert.match(page, /starts_at: startsAt\.toISOString\(\)/);
  assert.match(page, /ends_at: endsAt\?\.toISOString\(\) \?\? null/);
  assert.match(page, /originalEnd\.getTime\(\) - originalStart\.getTime\(\)/);
});

test("calendar drag-and-drop has localized guidance and outcomes", () => {
  const translations = source("src/lib/i18n/translations.ts");

  assert.match(translations, /"calendar\.dragToReschedule"/);
  assert.match(translations, /"calendar\.eventRescheduled"/);
  assert.match(translations, /"calendar\.couldNotReschedule"/);
});
