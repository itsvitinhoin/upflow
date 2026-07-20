import test from "node:test";
import assert from "node:assert/strict";
import { mapPosition, mapPriority, mapStatus } from "../../src/lib/clickup-import";
import { clickupTasks } from "../../src/lib/clickup";

test("ClickUp statuses map to supported Upflow statuses", () => {
  assert.equal(mapStatus("done"), "done");
  assert.equal(mapStatus("in progress"), "in_progress");
  assert.equal(mapStatus("custom agency status"), "todo");
});

test("ClickUp priorities map safely", () => {
  assert.equal(mapPriority("urgent"), "high");
  assert.equal(mapPriority("high"), "high");
  assert.equal(mapPriority("1"), "high");
  assert.equal(mapPriority(2), "high");
  assert.equal(mapPriority("low"), "low");
  assert.equal(mapPriority("4"), "low");
  assert.equal(mapPriority(undefined), "medium");
});

test("ClickUp fractional ordering is safe for Upflow integer task positions", () => {
  assert.equal(mapPosition("42.6"), 43);
  assert.equal(mapPosition("not-a-number"), 0);
  assert.equal(mapPosition(2_147_483_648), 2_147_483_647);
});

test("ClickUp task parsing accepts assigned tasks returned by the list endpoint", async (t) => {
  const previousToken = process.env.CLICKUP_API_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.CLICKUP_API_TOKEN = "test-token";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    tasks: [{
      id: "task-1",
      name: "Assigned task",
      description: null,
      text_content: null,
      status: { status: "in progress" },
      priority: { priority: "2" },
      due_date: null,
      orderindex: 0,
      archived: false,
      assignees: [123, { id: 456, email: null }, { id: 789, email: "owner@example.com" }],
      subtasks: ["child-1", { id: "child-2" }],
      attachments: [{ id: "attachment-1", url: "not-a-url" }],
    }],
    last_page: true,
  }))) as typeof fetch;
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.CLICKUP_API_TOKEN;
    else process.env.CLICKUP_API_TOKEN = previousToken;
  });

  const response = await clickupTasks("list-1", 0);

  assert.deepEqual(response.tasks[0].assignees, [{}, {}, { email: "owner@example.com" }]);
  assert.deepEqual(response.tasks[0].subtasks, [{ id: "child-1" }, { id: "child-2" }]);
});
