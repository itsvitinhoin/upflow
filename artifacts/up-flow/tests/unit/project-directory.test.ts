import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProjectDirectoryWhere,
  directoryTabWhere,
  parseProjectDirectoryQuery,
  projectDirectoryOrderBy,
} from "../../src/lib/project-directory";

test("project directory query defaults to the client directory", () => {
  const result = parseProjectDirectoryQuery(new URLSearchParams());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(result.value, {
    tab: "clients",
    q: "",
    space: null,
    folder: null,
    sort: "name",
    cursor: null,
    limit: 30,
  });
});

test("project directory validates tabs and caps pagination", () => {
  assert.deepEqual(
    parseProjectDirectoryQuery(new URLSearchParams("tab=unknown")),
    { ok: false, error: "Invalid tab" },
  );

  const result = parseProjectDirectoryQuery(
    new URLSearchParams("tab=operations&sort=due&limit=999&cursor=next"),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.tab, "operations");
  assert.equal(result.value.sort, "due");
  assert.equal(result.value.limit, 100);
  assert.equal(result.value.cursor, "next");
});

test("directory tabs always keep onboarding projects out of the directory", () => {
  assert.deepEqual(directoryTabWhere("clients"), {
    status: "active",
    kind: "client",
  });
  assert.deepEqual(directoryTabWhere("operations"), {
    status: "active",
    kind: "operational_queue",
  });
  assert.deepEqual(directoryTabWhere("archived"), {
    status: "archived",
    kind: { not: "onboarding" },
  });
});

test("directory search covers the full project hierarchy", () => {
  const where = buildProjectDirectoryWhere(
    { workspace_id: "workspace-1" },
    {
      tab: "clients",
      q: "Acme",
      space: "space-1",
      folder: "folder-1",
    },
  );

  assert.deepEqual(where, {
    AND: [
      { workspace_id: "workspace-1" },
      { status: "active", kind: "client" },
      { space_id: "space-1" },
      { folder_id: "folder-1" },
      {
        OR: [
          { name: { contains: "Acme", mode: "insensitive" } },
          { company: { name: { contains: "Acme", mode: "insensitive" } } },
          { space: { name: { contains: "Acme", mode: "insensitive" } } },
          { folder: { name: { contains: "Acme", mode: "insensitive" } } },
        ],
      },
    ],
  });
});

test("due sorting keeps projects without a due date at the end", () => {
  assert.deepEqual(projectDirectoryOrderBy("due"), [
    { due_date: { sort: "asc", nulls: "last" } },
    { name: "asc" },
    { id: "asc" },
  ]);
});
