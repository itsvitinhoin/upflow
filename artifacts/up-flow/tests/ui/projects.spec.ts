import { test, expect } from "@playwright/test";
import { SEEDED, uniq } from "../helpers";
import {
  createProjectViaApi,
  createTaskViaApi,
  loggedInContext,
  requireChromiumOrSkip,
} from "./_ui-helpers";

/**
 * Projects index + project detail page coverage:
 *   * /projects: hover-revealed "Move" button opens MoveToSpaceDialog,
 *     header "New Project" opens the dialog.
 *   * /projects/[id]: ProjectToolbar (list/board toggle, search filter,
 *     filter popover, group/sort dropdowns, column toggle), kanban DnD
 *     (via keyboard sensor — hello-pangea/dnd supports space + arrows),
 *     task detail sheet (open from list, edit, close).
 */
test.describe("Projects index", () => {
  requireChromiumOrSkip();

  test("header '+ New Project' button on /projects opens the New Project dialog", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/projects");
    await page
      .getByRole("button", { name: /^New Project$/ })
      .first()
      .click();
    await expect(
      page.getByRole("dialog", { name: "New Project" }),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "New Project" })
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "New Project" }),
    ).toBeHidden();

    await ctx.close();
  });

  test("Move button on a project card opens the MoveToSpaceDialog", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const name = uniq("MoveProj");
    await createProjectViaApi(ctx, name);

    const page = await ctx.newPage();
    await page.goto("/projects");

    const card = page
      .locator("h3", { hasText: name })
      .locator("..")
      .locator("..")
      .locator("..");
    // The Move button uses opacity-0 + group-hover. Force-click via hover.
    await card.hover();
    const move = card.getByRole("button", { name: /Move/ }).first();
    await move.click({ force: true });
    const dialog = page.getByRole("dialog", { name: "Move project" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(name, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await ctx.close();
  });
});

test.describe("Project detail page (toolbar + kanban + list + task sheet)", () => {
  requireChromiumOrSkip();

  test("toolbar list/board toggle and inline search filter work end-to-end", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("ToolbarProj"));
    const keepTitle = uniq("KEEP");
    const dropTitle = uniq("DROP");
    await createTaskViaApi(ctx, projectId, keepTitle);
    await createTaskViaApi(ctx, projectId, dropTitle);

    const page = await ctx.newPage();
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText(keepTitle)).toBeVisible();
    await expect(page.getByText(dropTitle)).toBeVisible();

    // List → Board toggle: kanban renders three columns. Header text is
    // "To Do" / "In Progress" / "Done" (uppercase is CSS only).
    await page.getByRole("button", { name: /^Board$/ }).click();
    await expect(page.getByText("To Do", { exact: true })).toBeVisible();
    await expect(page.getByText("In Progress", { exact: true })).toBeVisible();
    await expect(page.getByText("Done", { exact: true })).toBeVisible();

    // Back to list and use the toolbar's inline search to filter.
    await page.getByRole("button", { name: /^List$/ }).click();
    await page.getByPlaceholder("Search tasks...").fill(keepTitle);
    // The toolbar search filters in the board view too; reapply.
    await page.getByRole("button", { name: /^Board$/ }).click();
    await expect(page.getByText(keepTitle)).toBeVisible();
    await expect(page.getByText(dropTitle)).toBeHidden();

    await ctx.close();
  });

  test("group/sort/filter/columns toolbar controls open their menus", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("MenusProj"));
    await createTaskViaApi(ctx, projectId, uniq("T"), { priority: "high" });

    const page = await ctx.newPage();
    await page.goto(`/projects/${projectId}`);

    // Group menu.
    await page.getByRole("button", { name: /^Group:/ }).click();
    await page.getByRole("button", { name: "Priority", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /^Group: Priority$/ }),
    ).toBeVisible();

    // Sort menu.
    await page.getByRole("button", { name: /^Sort:/ }).click();
    await page.getByRole("button", { name: "Due date", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /^Sort: Due date$/ }),
    ).toBeVisible();

    // Filter popover.
    await page.getByRole("button", { name: /^Filter$/ }).click();
    await page.getByRole("button", { name: "High", exact: true }).click();
    // A filter is now active — the button counter renders "1".
    await expect(
      page.getByRole("button", { name: /Filter\s*1/ }).first(),
    ).toBeVisible();

    // Columns dropdown.
    await page.getByRole("button", { name: /^Columns$/ }).click();
    await expect(page.getByRole("button", { name: "Assignee" })).toBeVisible();

    await ctx.close();
  });

  test("toolbar 'Show closed' and sort-direction buttons toggle their state", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("MiscProj"));
    const done = uniq("Done-Task");
    await createTaskViaApi(ctx, projectId, done, { status: "done" });
    const open = uniq("Open-Task");
    await createTaskViaApi(ctx, projectId, open);

    const page = await ctx.newPage();
    await page.goto(`/projects/${projectId}`);

    // By default "Show closed" is off — the done task is hidden.
    await expect(page.getByText(open)).toBeVisible();
    await expect(page.getByText(done)).toBeVisible();
    await page.getByRole("button", { name: /^Show closed$/ }).click();
    await expect(page.getByText(done)).toBeHidden();
    await page.getByRole("button", { name: /^Show closed$/ }).click();
    await expect(page.getByText(done)).toBeVisible();

    // Sort direction button is a single-char "↑"/"↓" button with a tooltip.
    const sortDir = page.getByRole("button", {
      name: /^Sort (asc|desc)ending$/,
    });
    const initialTitle = await sortDir.getAttribute("title");
    await sortDir.click();
    await expect(sortDir).not.toHaveAttribute("title", initialTitle ?? "");

    await ctx.close();
  });

  test("kanban drag-and-drop moves a task between columns (keyboard sensor)", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("DnDProj"));
    const title = uniq("Drag-Me");
    await createTaskViaApi(ctx, projectId, title);

    const page = await ctx.newPage();
    await page.goto(`/projects/${projectId}`);
    await page.getByRole("button", { name: /^Board$/ }).click();

    // Find the draggable card. @hello-pangea/dnd renders the drag handle
    // with data-rfd-drag-handle-draggable-id on the element with the
    // tabIndex; targeting that element directly avoids accidental focus on
    // a child node and makes the keyboard sensor reliable.
    const handle = page
      .locator(`[data-rfd-drag-handle-draggable-id]`)
      .filter({ hasText: title })
      .first();
    await expect(handle).toBeVisible();
    await handle.focus();

    // Wait for the persisted reorder PATCH so the reload below shows the
    // server-side truth rather than just the optimistic UI state.
    const reorder = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/projects/${projectId}/reorder-tasks`) && r.ok(),
    );
    // Keyboard sensor: Space lifts, ArrowRight moves between columns,
    // Space drops.
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await reorder;

    // Reload and confirm the task is now under the in_progress droppable.
    await page.reload();
    await page.getByRole("button", { name: /^Board$/ }).click();
    const inProgressDroppable = page.locator(
      "[data-rfd-droppable-id='in_progress']",
    );
    await expect(inProgressDroppable.getByText(title)).toBeVisible({
      timeout: 10_000,
    });

    await ctx.close();
  });

  test("task detail sheet: edits title, status, priority, due date and posts a comment", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("SheetProj"));
    const title = uniq("Sheet-Task");
    await createTaskViaApi(ctx, projectId, title);

    const page = await ctx.newPage();
    await page.goto(`/projects/${projectId}`);
    await page.getByText(title).first().click();

    // Editable title input pre-populated with the task title.
    const titleInput = page.locator(`input[value="${title}"]`).first();
    await expect(titleInput).toBeVisible();

    // Helper: PATCH /api/tasks/:id awaiter.
    const awaitTaskPatch = () =>
      page.waitForResponse(
        (r) =>
          /\/api\/tasks\/[^/]+$/.test(r.url()) &&
          r.request().method() === "PATCH" &&
          r.ok(),
      );

    // 1) Title edit.
    let p = awaitTaskPatch();
    await titleInput.fill(`${title}-EDITED`);
    await titleInput.blur();
    await p;

    // 2) Status select → "in_progress".
    p = awaitTaskPatch();
    await page
      .locator("select")
      .filter({ has: page.locator('option[value="todo"]') })
      .first()
      .selectOption("in_progress");
    await p;

    // 3) Priority select → "high".
    p = awaitTaskPatch();
    await page
      .locator("select")
      .filter({ has: page.locator('option[value="low"]') })
      .first()
      .selectOption("high");
    await p;

    // 4) Due date input (yyyy-mm-dd).
    const dueDate = new Date(Date.now() + 7 * 86400_000);
    const due = [
      String(dueDate.getDate()).padStart(2, "0"),
      String(dueDate.getMonth() + 1).padStart(2, "0"),
      dueDate.getFullYear(),
    ].join("/");
    p = awaitTaskPatch();
    const dueInput = page.getByPlaceholder("dd/mm/aaaa").first();
    await dueInput.fill(due);
    await dueInput.blur();
    await p;

    // 4b) Assignee select → first non-empty option. The task-detail-sheet
    // assignee <select> is the one whose first option is the empty
    // "Unassigned" string. We pick the SEEDED admin by value (user id).
    const assigneeSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value=""]') })
      .first();
    const firstUserValue = await assigneeSelect
      .locator("option")
      .nth(1)
      .getAttribute("value");
    if (firstUserValue) {
      p = awaitTaskPatch();
      await assigneeSelect.selectOption(firstUserValue);
      await p;
    }

    // 5) Comment post — type into the inline form and submit. /api/comments
    // POSTs and the input clears.
    const commentInput = page.getByPlaceholder("Add a comment...");
    await expect(commentInput).toBeVisible();
    const commentPost = page.waitForResponse(
      (r) =>
        r.url().includes("/api/comments") && r.request().method() === "POST",
    );
    await commentInput.fill("Looks good to me");
    await commentInput.press("Enter");
    await commentPost;
    await expect(commentInput).toHaveValue("");

    // 6) Close the sheet — press Escape and assert the sheet unmounts
    // (the comment input is unique to the sheet, so its absence proves it).
    await page.keyboard.press("Escape");
    await expect(commentInput).toBeHidden();

    await ctx.close();
  });

  test("list-view inline custom-field editor PUTs the value to /api/tasks/:id/custom-fields", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("CFProj"));
    const taskTitle = uniq("CF-Task");
    await createTaskViaApi(ctx, projectId, taskTitle);

    // Seed a text custom-field definition on this project (admin endpoint).
    const fieldName = "Notes";
    const defRes = await ctx.request.post(
      `/api/projects/${projectId}/custom-fields`,
      {
        data: { name: fieldName, type: "text" },
      },
    );
    expect(defRes.ok()).toBeTruthy();

    const page = await ctx.newPage();
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText(taskTitle)).toBeVisible();

    // Make the Notes column visible (Columns dropdown lists custom fields too).
    await page.getByRole("button", { name: /^Columns$/ }).click();
    const colToggle = page.getByRole("button", { name: fieldName });
    if (await colToggle.count()) await colToggle.first().click();
    await page.keyboard.press("Escape").catch(() => undefined);

    // The text custom-field renders an <input>. Hover the row, fill, blur,
    // and assert the PUT to /api/tasks/:id/custom-fields fires.
    const taskRow = page
      .locator("div.grid.items-center")
      .filter({ has: page.getByText(taskTitle, { exact: true }) })
      .last();
    await taskRow.hover();
    const cfInput = taskRow.locator('input[type="text"]').first();
    const put = page.waitForResponse(
      (r) =>
        /\/api\/tasks\/[^/]+\/custom-fields/.test(r.url()) &&
        r.request().method() === "PUT",
    );
    await cfInput.fill("hello world");
    await cfInput.blur();
    await put;

    await ctx.close();
  });

  test("list-view group collapse hides its tasks and completion checkbox toggles status", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("ListGroupProj"));
    const title = uniq("Group-Task");
    await createTaskViaApi(ctx, projectId, title);

    const page = await ctx.newPage();
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText(title)).toBeVisible();

    // The list groups by status by default; use the group's accessible toggle
    // instead of relying on the surrounding layout or button order.
    await page.getByRole("button", { name: "Collapse To Do" }).click();
    await expect(page.getByText(title)).toBeHidden();
    await page.getByRole("button", { name: "Expand To Do" }).click();
    await expect(page.getByText(title)).toBeVisible();

    // Completion checkbox: each row has a circular toggle with title="Toggle complete".
    // Clicking it PATCHes status → "done".
    const patch = page.waitForResponse(
      (r) =>
        /\/api\/tasks\/[^/]+$/.test(r.url()) &&
        r.request().method() === "PATCH" &&
        r.ok(),
    );
    const taskRow = page
      .locator("div.grid.items-center")
      .filter({ has: page.getByText(title, { exact: true }) })
      .last();
    await taskRow.locator('button[title="Completed"]').click();
    await patch;

    await ctx.close();
  });
});
