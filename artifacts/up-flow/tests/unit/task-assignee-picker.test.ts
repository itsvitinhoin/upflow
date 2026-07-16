import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { translations } from "../../src/lib/i18n/translations";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("task assignee picker is one accessible searchable combobox", () => {
  const picker = read("src/components/projects/task-assignee-picker.tsx");
  const popover = read("src/components/ui/popover.tsx");

  assert.match(picker, /<Popover/);
  assert.match(picker, /<Command>/);
  assert.match(picker, /<CommandInput/);
  assert.match(picker, /<CommandItem/);
  assert.match(picker, /role="combobox"/);
  assert.match(picker, /aria-expanded=\{open\}/);
  assert.match(picker, /aria-controls=\{listId\}/);
  assert.match(picker, /event\.key === "ArrowDown"/);
  assert.match(picker, /event\.key === "ArrowUp"/);
  assert.doesNotMatch(picker, /<select/);
  assert.match(popover, /@radix-ui\/react-popover/);
});

test("task assignee picker supports clearing and operational states", () => {
  const picker = read("src/components/projects/task-assignee-picker.tsx");

  assert.match(picker, /loading\?: boolean/);
  assert.match(picker, /disabled=\{interactionDisabled\}/);
  assert.match(picker, /selectAssignee\(""\)/);
  assert.match(picker, /onClick=\{\(\) => onChange\(""\)\}/);
  assert.match(picker, /taskAssigneePicker\.noMembers/);
  assert.match(picker, /taskAssigneePicker\.noMatches/);
  assert.match(picker, /taskAssigneePicker\.selectedUnavailable/);
  assert.match(picker, /aria-live="polite"/);
});

test("task assignee picker copy is localized in English and Portuguese", () => {
  const keys = [
    "taskAssigneePicker.searchPlaceholder",
    "taskAssigneePicker.activeMembers",
    "taskAssigneePicker.clear",
    "taskAssigneePicker.loading",
    "taskAssigneePicker.noMembers",
    "taskAssigneePicker.noMatches",
    "taskAssigneePicker.selectedUnavailable",
  ];

  for (const key of keys) {
    assert.ok(translations.en[key], `missing English translation for ${key}`);
    assert.ok(translations["pt-BR"][key], `missing Portuguese translation for ${key}`);
  }
});
