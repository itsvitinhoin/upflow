import assert from "node:assert/strict";
import test from "node:test";
import { timeEntryDurationSeconds } from "../../src/lib/time-entry-duration";

const now = new Date("2026-07-31T12:10:00.000Z");

test("time entry duration only grows during an active running segment", () => {
  assert.equal(
    timeEntryDurationSeconds(
      {
        status: "running",
        started_at: "2026-07-31T11:00:00.000Z",
        active_started_at: "2026-07-31T12:00:00.000Z",
        duration_seconds: 600,
      },
      now,
    ),
    1200,
  );

  assert.equal(
    timeEntryDurationSeconds(
      {
        status: "paused",
        started_at: "2026-07-31T11:00:00.000Z",
        active_started_at: null,
        duration_seconds: 600,
      },
      now,
    ),
    600,
  );
});

test("legacy running entries fall back to their original start time", () => {
  assert.equal(
    timeEntryDurationSeconds(
      {
        status: "running",
        started_at: "2026-07-31T12:00:00.000Z",
        active_started_at: null,
        duration_seconds: 0,
      },
      now,
    ),
    600,
  );
});
