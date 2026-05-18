import { test, expect } from "@playwright/test";
import { SEEDED, uniq } from "../helpers";
import {
  createProjectViaApi,
  createTaskViaApi,
  loggedInContext,
  requireChromiumOrSkip,
} from "./_ui-helpers";

/**
 * Main dashboard `/`:
 *   * Five quick-action buttons open their dialogs
 *   * Stat cards toggle the statusFilter (aria-pressed flips)
 *   * Task-row "Actions" menu: Mark done / Edit / Delete (with confirm)
 *   * Progress widget "New Task" button opens the New Task dialog
 *   * Happy-path create via New Project dialog produces a visible project
 */
test.describe("Dashboard quick actions and task rows", () => {
  requireChromiumOrSkip();

  test("each quick action opens its dialog", async ({ browser, baseURL }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");

    // New Project
    await page.getByRole("button", { name: "Create Project" }).click();
    await expect(page.getByRole("dialog", { name: "New Project" })).toBeVisible();
    await page.keyboard.press("Escape").catch(() => undefined);
    // Esc isn't wired on every dialog — explicitly Cancel.
    const cancel = page.getByRole("dialog", { name: "New Project" }).getByRole("button", {
      name: "Cancel",
    });
    if (await cancel.count()) await cancel.click();

    // New Task
    await page.getByRole("button", { name: "Create Task" }).click();
    await expect(page.getByRole("dialog", { name: "New Task" })).toBeVisible();
    await page
      .getByRole("dialog", { name: "New Task" })
      .getByRole("button", { name: "Cancel" })
      .click();

    // Invite / Schedule / Company — these are <form> overlays (no dialog
    // role) so we assert by the heading each renders, then Cancel out.
    const overlays: { trigger: string; heading: string }[] = [
      { trigger: "Invite to Team", heading: "Invite to team" },
      { trigger: "Schedule Meeting", heading: "Schedule meeting" },
      { trigger: "Create a Company", heading: "Create company" },
    ];
    for (const { trigger, heading } of overlays) {
      await page.getByRole("button", { name: trigger }).click();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).first().click();
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeHidden();
    }

    await ctx.close();
  });

  test("stat cards toggle the status filter (aria-pressed)", async ({ browser, baseURL }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    const card = page.getByRole("button", { name: /Upcoming Actions/i });
    await expect(card).toHaveAttribute("aria-pressed", "false");
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "false");

    await ctx.close();
  });

  test("creating a new project via the header dialog adds it to /projects", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    const name = uniq("UI-Proj");
    await page
      .getByRole("button", { name: /^New Project$/ })
      .first()
      .click();
    const dlg = page.getByRole("dialog", { name: "New Project" });
    await dlg.getByPlaceholder("e.g. Website Redesign").fill(name);
    await dlg.getByRole("button", { name: /Create Project/i }).click();
    await expect(dlg).toBeHidden({ timeout: 10_000 });

    await page.goto("/projects");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await ctx.close();
  });

  test("task row 'More' menu marks a task done and removes it from the upcoming list", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    // Seed a project + task for the admin so a row exists deterministically.
    const projectId = await createProjectViaApi(ctx, uniq("Dash"));
    const title = uniq("Task-MarkDone");
    await createTaskViaApi(ctx, projectId, title, {
      due_date: new Date(Date.now() + 86400_000).toISOString(),
    });

    const page = await ctx.newPage();
    await page.goto("/");
    const row = page.locator("section", { has: page.getByText("Upcoming tasks") }).first();
    await expect(row.getByText(title)).toBeVisible();

    await row.getByRole("button", { name: new RegExp(`Actions for ${title}`) }).click();
    await page.getByRole("menuitem", { name: /Mark done/i }).click();

    await expect(row.getByText(title)).toBeHidden({ timeout: 10_000 });

    await ctx.close();
  });

  test("task row 'Delete' confirms via window.confirm and removes the row", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("Dash"));
    const title = uniq("Task-Delete");
    await createTaskViaApi(ctx, projectId, title, {
      due_date: new Date(Date.now() + 86400_000).toISOString(),
    });

    const page = await ctx.newPage();
    page.on("dialog", (d) => d.accept().catch(() => undefined));
    await page.goto("/");
    const section = page.locator("section", { has: page.getByText("Upcoming tasks") }).first();
    await expect(section.getByText(title)).toBeVisible();

    await section.getByRole("button", { name: new RegExp(`Actions for ${title}`) }).click();
    await page.getByRole("menuitem", { name: /^Delete$/ }).click();

    await expect(section.getByText(title)).toBeHidden({ timeout: 10_000 });

    await ctx.close();
  });

  test("progress widget 'New Task' button opens the New Task dialog", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    // The progress widget's button is `+ New Task` (with leading icon). The
    // header's button is "+ New Project". Disambiguate by exact name match.
    await page.getByRole("button", { name: /^New Task$/ }).first().click();
    await expect(page.getByRole("dialog", { name: "New Task" })).toBeVisible();

    await ctx.close();
  });
});
