import test from "node:test";
import assert from "node:assert/strict";
import {
  mapClickupTaskStatus,
  mapPosition,
  mapPriority,
  mapStatus,
} from "../../src/lib/clickup-import";
import { clickupList, clickupTasks } from "../../src/lib/clickup";
import {
  CLICKUP_STATUS_FIELD_NAME,
  clickupStatusOptions,
  mergeClickupStatusNames,
} from "../../src/lib/clickup-status";

test("ClickUp statuses map to supported Upflow statuses", () => {
  assert.equal(mapStatus("done"), "done");
  assert.equal(mapStatus("Conclu\u00eddo"), "done");
  assert.equal(mapStatus("Finalizada"), "done");
  assert.equal(mapStatus("Publicado"), "done");
  assert.equal(mapStatus("Closed"), "done");
  assert.equal(mapStatus("Aprovado"), "done");
  assert.equal(mapStatus("in progress"), "in_progress");
  assert.equal(mapStatus("Em andamento"), "in_progress");
  assert.equal(mapStatus("Em produ\u00e7\u00e3o"), "in_progress");
  assert.equal(mapStatus("Aguardando aprova\u00e7\u00e3o"), "in_progress");
  assert.equal(mapStatus("A fazer"), "todo");
  assert.equal(mapStatus("custom agency status"), "todo");
  assert.equal(
    mapClickupTaskStatus({ status: "Approval", type: "closed" }),
    "done",
  );
});

test("ClickUp workflow stages retain their source order, names, and colors", () => {
  const stages = clickupStatusOptions([
    { status: "PRODUCAO", color: "00c853", orderindex: "4", type: "open" },
    { status: "BRIEFING RECEBIDO", color: "757575", orderindex: "0", type: "open" },
    { status: "LANDING", color: "9c27b0", orderindex: "3", type: "open" },
    { status: "DIRECAO DE ARTE", color: "ffc107", orderindex: "2", type: "open" },
    { status: "BRIEFING PRONTO", color: "00bcd4", orderindex: "1", type: "open" },
    { status: "PRODUCAO", color: "00c853", orderindex: "5", type: "open" },
  ]);

  assert.equal(CLICKUP_STATUS_FIELD_NAME, "ClickUp Status");
  assert.deepEqual(
    stages.map((stage) => [stage.name, stage.color]),
    [
      ["BRIEFING RECEBIDO", "#757575"],
      ["BRIEFING PRONTO", "#00bcd4"],
      ["DIRECAO DE ARTE", "#ffc107"],
      ["LANDING", "#9c27b0"],
      ["PRODUCAO", "#00c853"],
    ],
  );
  assert.deepEqual(
    mergeClickupStatusNames(
      stages.map((stage) => stage.name),
      ["ARCHIVED", "producao"],
    ),
    [
      "BRIEFING RECEBIDO",
      "BRIEFING PRONTO",
      "DIRECAO DE ARTE",
      "LANDING",
      "PRODUCAO",
      "ARCHIVED",
    ],
  );
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

test("ClickUp list parsing retains status metadata used for the imported board", async (t) => {
  const previousToken = process.env.CLICKUP_API_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.CLICKUP_API_TOKEN = "test-token";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: "list-1",
    name: "Design & Criativo",
    statuses: [
      { status: "BRIEFING RECEBIDO", color: "757575", orderindex: "0", type: "open" },
      { status: "EDICAO", color: "f44336", orderindex: "5", type: "closed" },
    ],
  }))) as typeof fetch;
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.CLICKUP_API_TOKEN;
    else process.env.CLICKUP_API_TOKEN = previousToken;
  });

  const list = await clickupList("list-1");

  assert.deepEqual(list.statuses, [
    { status: "BRIEFING RECEBIDO", color: "757575", orderindex: "0", type: "open" },
    { status: "EDICAO", color: "f44336", orderindex: "5", type: "closed" },
  ]);
});
