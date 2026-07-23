import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTaskBoardStatusValue,
  resolveTaskBoardStatus,
  taskBoardStatusValue,
  taskStatusForTaskBoardOption,
} from "../../src/lib/task-board-status";
import {
  CLICKUP_STATUS_FIELD_NAME,
} from "../../src/lib/clickup-status";
import { RH_BOARD_FIELD_NAME } from "../../src/lib/rh-board";
import { SPACE_TASK_STATUS_FIELD_NAME } from "../../src/lib/space-task-status";
import type { CustomFieldDefinition, WorkflowStatus } from "../../src/lib/types";

function dropdown(id: string, name: string, options: string[]): CustomFieldDefinition {
  return {
    id,
    project_id: "project-1",
    name,
    type: "dropdown",
    options,
    position: 0,
    created_at: "2026-07-23T00:00:00.000Z",
  };
}

function workflow(
  name: string,
  stageOrder: number,
  terminal = false,
  scope: Pick<WorkflowStatus, "project_id" | "space_id"> = {
    project_id: "project-1",
    space_id: null,
  },
): WorkflowStatus {
  return {
    id: `${name}-${stageOrder}`,
    workspace_id: "workspace-1",
    project_id: scope.project_id,
    space_id: scope.space_id,
    key: name.toLowerCase().replaceAll(" ", "-"),
    name,
    category: "task",
    stage_order: stageOrder,
    color: null,
    terminal,
    active: true,
    created_at: "2026-07-23T00:00:00.000Z",
    updated_at: "2026-07-23T00:00:00.000Z",
  };
}

test("Space workflow stages take precedence and map to task progress", () => {
  const board = resolveTaskBoardStatus({
    projectId: "project-1",
    spaceId: "space-1",
    customFields: [
      dropdown("clickup", CLICKUP_STATUS_FIELD_NAME, ["Backlog", "Done"]),
      dropdown("space", SPACE_TASK_STATUS_FIELD_NAME, ["Briefing", "Production", "Delivered"]),
    ],
    workflowStatuses: [
      workflow("Briefing", 0, false, { project_id: null, space_id: "space-1" }),
      workflow("Production", 1, false, { project_id: null, space_id: "space-1" }),
      workflow("Delivered", 2, true, { project_id: null, space_id: "space-1" }),
    ],
  });

  assert.ok(board);
  assert.equal(board.kind, "space");
  assert.equal(board.field.id, "space");
  assert.deepEqual(
    board.options.map((option) => [option.value, option.taskStatus]),
    [
      ["Briefing", "todo"],
      ["Production", "in_progress"],
      ["Delivered", "done"],
    ],
  );
  assert.equal(defaultTaskBoardStatusValue(board, "todo"), "Briefing");
  assert.equal(defaultTaskBoardStatusValue(board, "in_progress"), "Production");
  assert.equal(defaultTaskBoardStatusValue(board, "done"), "Delivered");
  assert.equal(taskStatusForTaskBoardOption(board, "Delivered"), "done");
});

test("ClickUp boards retain their exact stage and sync their generic lifecycle", () => {
  const board = resolveTaskBoardStatus({
    projectId: "project-1",
    customFields: [dropdown("clickup", CLICKUP_STATUS_FIELD_NAME, ["A fazer", "Em revisão", "Aprovado"])],
    workflowStatuses: [
      workflow("A fazer", 0),
      workflow("Em revisão", 1),
      workflow("Aprovado", 2, true),
    ],
  });

  assert.ok(board);
  assert.equal(taskBoardStatusValue(board, "Em revisão", "todo"), "Em revisão");
  assert.equal(taskBoardStatusValue(board, "missing", "done"), "Aprovado");
  assert.equal(taskStatusForTaskBoardOption(board, "Em revisão"), "in_progress");
  assert.equal(taskStatusForTaskBoardOption(board, "Aprovado"), "done");
});

test("RH board buckets do not overwrite the task lifecycle", () => {
  const board = resolveTaskBoardStatus({
    projectId: "project-1",
    customFields: [dropdown("rh", RH_BOARD_FIELD_NAME, ["BOAS VINDAS", "DESLIGAMENTO"])],
  });

  assert.ok(board);
  assert.equal(board.kind, "rh");
  assert.equal(defaultTaskBoardStatusValue(board, "done"), "BOAS VINDAS");
  assert.equal(taskStatusForTaskBoardOption(board, "DESLIGAMENTO"), null);
});
