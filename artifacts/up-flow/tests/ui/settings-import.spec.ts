import { test, expect } from "@playwright/test";
import { SEEDED } from "../helpers";
import { loggedInContext, requireChromiumOrSkip } from "./_ui-helpers";

/**
 * /settings/import (ClickUp import). The page wraps three real ClickUp
 * endpoints (`/api/clickup/teams`, `/api/clickup/preview`,
 * `/api/clickup/import`). We stub them at the browser-network level so the
 * tests never touch a real ClickUp account — only the UI wiring is verified.
 *
 *   * Token input + "Connect" populates the workspace `<select>`.
 *   * Selecting a workspace reveals "Preview counts" and "Start import".
 *   * "Preview counts" renders the four-tile summary.
 *   * "Start import" opens a window.confirm; accepting it streams progress
 *     and ends with a "Import complete" affordance.
 *   * An error from the stubbed `/api/clickup/teams` surfaces a toast.
 */
test.describe("ClickUp import (stubbed network)", () => {
  requireChromiumOrSkip();

  test("happy path: connect → preview → import", async ({ browser, baseURL }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();

    await page.route("**/api/clickup/teams", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ teams: [{ id: "wk_1", name: "Stub Workspace" }] }),
      }),
    );
    await page.route("**/api/clickup/preview", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ spaces: 2, folders: 3, lists: 4, tasks: 5 }),
      }),
    );
    await page.route("**/api/clickup/import", (route) => {
      const progress = {
        stage: "done",
        spaces_done: 2,
        spaces_total: 2,
        folders_done: 3,
        folders_total: 3,
        lists_done: 4,
        lists_total: 4,
        tasks_done: 5,
        tasks_total: 5,
        created: { spaces: 2, folders: 3, lists: 4, tasks: 5, users: 1 },
        updated: { spaces: 0, folders: 0, lists: 0, tasks: 0 },
        errors: [],
        done: true,
      };
      route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: JSON.stringify(progress) + "\n",
      });
    });

    await page.goto("/settings/import");
    await page.getByLabel("Personal API token").fill("pk_test_token");
    await page.getByRole("button", { name: "Connect" }).click();

    // Workspace select shows up and auto-selects the single option.
    await expect(page.getByLabel("ClickUp workspace")).toBeVisible();
    await expect(page.getByText("Stub Workspace")).toBeVisible();

    // Preview button reveals the four-tile summary.
    await page.getByRole("button", { name: /Preview counts/ }).click();
    await expect(page.getByText("Will import")).toBeVisible();
    await expect(page.getByText("Spaces").first()).toBeVisible();

    // Import button — accept the confirm() prompt.
    page.once("dialog", (d) => d.accept().catch(() => undefined));
    await page.getByRole("button", { name: /Start import/ }).click();
    await expect(page.getByText("Import complete")).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });

  test("a connect error surfaces a toast and leaves the form usable", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.route("**/api/clickup/teams", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid token (stub)" }),
      }),
    );
    await page.goto("/settings/import");
    await page.getByLabel("Personal API token").fill("pk_bad");
    await page.getByRole("button", { name: "Connect" }).click();

    // Sonner renders the toast in the DOM — match its text.
    await expect(page.getByText("Invalid token (stub)")).toBeVisible({ timeout: 5_000 });
    // Form is still around.
    await expect(page.getByLabel("Personal API token")).toBeVisible();

    await ctx.close();
  });
});
