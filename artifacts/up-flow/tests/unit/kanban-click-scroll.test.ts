import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

test("Kanban exposes accessible click-to-scroll status navigation", () => {
  const board = readFileSync(
    join(ROOT, "src/components/projects/kanban-board.tsx"),
    "utf8",
  );

  assert.match(board, /data-kanban-scroll-container/);
  assert.match(board, /data-kanban-scroll-target/);
  assert.match(board, /data-kanban-column-header/);
  assert.match(board, /data-kanban-active/);
  assert.match(board, /board\.scrollTo\(\{/);
  assert.match(board, /prefers-reduced-motion: reduce/);
  assert.match(board, /aria-controls/);
  assert.match(board, /aria-pressed/);
});
