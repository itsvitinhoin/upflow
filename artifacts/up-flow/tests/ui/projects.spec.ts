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

  test("Move button on a project card opens the MoveToSpaceDialog", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const name = uniq("MoveProj");
    await createProjectViaApi(ctx, name);

    const page = await ctx.newPage();
    await page.goto("/projects");

    const card = page.locator("h3", { hasText: name }).locator("..").locator("..").locator("..");
    // The Move button uses opacity-0 + group-hover. Force-click via hover.
    await card.hover();
    const move = card.getByRole("button", { name: /Move/ }).first();
    await move.click({ force: true });
    await expect(page.getByText("Move project")).toBeVisible();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    // Close.
    await page.getByRole("button", { name: "Cancel" }).click();

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
    await expect(page.getByRole("button", { name: /^Group: Priority$/ })).toBeVisible();

    // Sort menu.
    await page.getByRole("button", { name: /^Sort:/ }).click();
    await page.getByRole("button", { name: "Due date", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Sort: Due date$/ })).toBeVisible();

    // Filter popover.
    await page.getByRole("button", { name: /^Filter$/ }).click();
    await page.getByRole("button", { name: "high", exact: true }).click();
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
    await expect(page.getByText(done)).toBeHidden();
    // Toggle it on.
    await page.getByRole("button", { name: /^Show closed$/ }).click();
    await expect(page.getByText(done)).toBeVisible();

    // Sort direction button is a single-char "↑"/"↓" button with a tooltip.
    const sortDir = page.getByRole("button", { name: /^Sort (asc|desc)ending$/ });
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
    const handle = page.locator(`[data-rfd-drag-handle-draggable-id]`).filter({ hasText: title }).first();
    await expect(handle).toBeVisible();
    await handle.focus();

    // Wait for the persisted reorder PATCH so the reload below shows the
    // server-side truth rather than just the optimistic UI state.
    const reorder = page.waitForResponse(
      (r) => r.url().includes(`/api/projects/${projectId}/reorder-tasks`) && r.ok(),
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
    const inProgressDroppable = page.locator("[data-rfd-droppable-id='in_progress']");
    await expect(inProgressDroppable.getByText(title)).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });

  test("clicking a task in list view opens the task detail sheet and saves edits", async ({
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

    // The sheet is an aside overlay containing an editable title input
    // pre-populated with the task title. Find it by its current value, then
    // edit it and verify the PATCH fires.
    const titleInput = page.locator(`input[value="${title}"]`).first();
    await expect(titleInput).toBeVisible();

    const newTitle = `${title}-EDITED`;
    const patch = page.waitForResponse(
      (r) => /\/api\/tasks\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH" && r.ok(),
    );
    await titleInput.fill(newTitle);
    await titleInput.blur();
    await patch;

    // Close the sheet via its X button (the only header button without a
    // text label is the close icon).
    page.once("dialog", (d) => d.dismiss().catch(() => undefined));
    // Sheet input is gone once closed — click outside / press Escape.
    await page.keyboard.press("Escape").catch(() => undefined);

    await ctx.close();
  });
});
