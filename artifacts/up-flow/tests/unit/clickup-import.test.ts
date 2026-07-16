import test from "node:test";
import assert from "node:assert/strict";
import { mapPriority, mapStatus } from "../../src/lib/clickup-import";

test("ClickUp statuses map to supported Upflow statuses", () => {
  assert.equal(mapStatus("done"), "done");
  assert.equal(mapStatus("in progress"), "in_progress");
  assert.equal(mapStatus("custom agency status"), "todo");
});

test("ClickUp priorities map safely", () => {
  assert.equal(mapPriority("urgent"), "high");
  assert.equal(mapPriority("high"), "high");
  assert.equal(mapPriority("low"), "low");
  assert.equal(mapPriority(undefined), "medium");
});
