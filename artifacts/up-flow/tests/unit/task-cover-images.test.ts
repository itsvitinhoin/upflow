import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("task cover images are persisted, validated, and shown on board cards", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260526114500_add_task_cover_image/migration.sql");
  const tasksRoute = read("src/app/api/tasks/route.ts");
  const taskRoute = read("src/app/api/tasks/[id]/route.ts");
  const uploadRoute = read("src/app/api/uploads/task-cover/route.ts");
  const board = read("src/components/projects/kanban-board.tsx");
  const sheet = read("src/components/projects/task-detail-sheet.tsx");
  const taskCreator = read("src/components/projects/task-create-sheet.tsx");
  const control = read("src/components/projects/task-cover-image-control.tsx");

  assert.match(schema, /cover_image_url\s+String\?/);
  assert.match(migration, /ADD COLUMN "cover_image_url" TEXT/);
  assert.match(tasksRoute, /cover_image_url/);
  assert.match(taskRoute, /Invalid cover_image_url/);
  assert.match(uploadRoute, /isWorkspaceAdminFor\(auth,\s*auth\.currentWorkspaceId\)/);
  assert.match(uploadRoute, /TASK_STORAGE_NOT_CONFIGURED/);
  assert.match(uploadRoute, /TASK_COVER_UPLOAD_FAILED/);
  assert.match(control, /\/api\/uploads\/task-cover/);
  assert.doesNotMatch(tasksRoute, /data:image/);
  assert.doesNotMatch(taskRoute, /data:image/);
  assert.match(board, /task\.cover_image_url/);
  assert.match(board, /aspect-video w-full object-cover/);
  assert.doesNotMatch(board, /priorityLabel/);
  assert.doesNotMatch(board, /shadow-\[0_0_12px_currentColor\]/);
  assert.match(sheet, /t\("task\.boardCoverImage"\)/);
  assert.match(taskCreator, /TaskCoverImageControl/);
  assert.match(taskCreator, /compact/);
  assert.match(control, /compact \? null/);
});
