import assert from "node:assert/strict";
import test from "node:test";
import { startOfToday, startOfWeekMonday, zonedStartOfDay } from "../../src/lib/time-range";

test("zonedStartOfDay defaults day boundaries to America/Sao_Paulo", () => {
  assert.equal(
    zonedStartOfDay(new Date("2026-05-27T12:00:00.000Z")).toISOString(),
    "2026-05-27T03:00:00.000Z",
  );

  assert.equal(
    zonedStartOfDay(new Date("2026-05-27T02:30:00.000Z")).toISOString(),
    "2026-05-26T03:00:00.000Z",
  );
});

test("dashboard today and week ranges use the app timezone", () => {
  const now = new Date("2026-05-27T12:00:00.000Z");

  assert.equal(startOfToday(now).toISOString(), "2026-05-27T03:00:00.000Z");
  assert.equal(startOfWeekMonday(now).toISOString(), "2026-05-25T03:00:00.000Z");
});
