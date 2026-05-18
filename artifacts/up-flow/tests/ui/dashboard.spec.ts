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

  test("each stat card filters the upcoming-tasks list and aria-pressed reflects state", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");

    const list = page.locator("section", { has: page.getByText("Upcoming tasks") }).first();
    await expect(list.getByRole("heading", { name: "Upcoming tasks" })).toBeVisible();

    const cards: { name: RegExp; heading: string }[] = [
      { name: /Upcoming Actions/i, heading: "Upcoming" },
      { name: /In progress Actions/i, heading: "In progress" },
      { name: /Completed Actions/i, heading: "Completed" },
    ];
    for (const { name, heading } of cards) {
      const card = page.getByRole("button", { name });
      await expect(card).toHaveAttribute("aria-pressed", "false");
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "true");
      // The filtered-list header text in the section above swaps.
      await expect(
        page.locator("section").filter({ has: page.getByRole("heading", { name: heading, exact: true }) }).first(),
      ).toBeVisible();
      // Click again to toggle off.
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "false");
    }
    await expect(list.getByRole("heading", { name: "Upcoming tasks" })).toBeVisible();

    await ctx.close();
  });

  test("Invite quick action submits emails and closes the form", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    // Stub the invites endpoint so the test doesn't depend on a real mail backend.
    await page.route("**/api/invites", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sent: 2 }),
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Invite to Team" }).click();
    const heading = page.getByRole("heading", { name: "Invite to team", exact: true });
    await expect(heading).toBeVisible();
    await page.getByPlaceholder("alice@acme.com, bob@acme.com").fill("a@x.com, b@x.com");
    const post = page.waitForResponse(
      (r) => r.url().includes("/api/invites") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Send invites/ }).click();
    await post;
    await expect(heading).toBeHidden();

    await ctx.close();
  });

  test("Schedule Meeting quick action submits and closes the form", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Schedule Meeting" }).click();
    const heading = page.getByRole("heading", { name: "Schedule meeting", exact: true });
    await expect(heading).toBeVisible();
    await page.getByPlaceholder("e.g. Sprint review").fill(uniq("Sprint"));
    // Pick the second color tag to exercise the color buttons.
    await page.getByRole("button", { name: "Color 2" }).click();
    await page.getByRole("button", { name: /^Schedule$/ }).click();
    await expect(heading).toBeHidden();

    await ctx.close();
  });

  test("Create a Company quick action submits and closes the form", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Create a Company" }).click();
    const heading = page.getByRole("heading", { name: "Create company", exact: true });
    await expect(heading).toBeVisible();
    await page.getByPlaceholder("Acme Corp").fill(uniq("Acme"));
    await page.getByPlaceholder("acme.com").fill("acme.test");
    await page.getByRole("button", { name: /^Create$/ }).click();
    await expect(heading).toBeHidden();

    await ctx.close();
  });

  test("task row 'Edit / details' menu item opens the task detail modal", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("Dash"));
    const title = uniq("Task-Edit");
    await createTaskViaApi(ctx, projectId, title, {
      due_date: new Date(Date.now() + 86400_000).toISOString(),
    });

    const page = await ctx.newPage();
    await page.goto("/");
    const section = page.locator("section", { has: page.getByText("Upcoming tasks") }).first();
    await section.getByRole("button", { name: new RegExp(`Actions for ${title}`) }).click();
    await page.getByRole("menuitem", { name: /Edit \/ details/i }).click();
    // The detail modal renders a "Status" label + select with the task title.
    await expect(page.getByText("Status", { exact: true })).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();

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

  test("Create Task quick action happy-path: pick project, set title, submit", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    // Seed a project so the New Task dialog has a selectable project.
    const projectName = uniq("TaskHostProj");
    await createProjectViaApi(ctx, projectName);

    const page = await ctx.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Create Task" }).click();
    const dlg = page.getByRole("dialog", { name: "New Task" });
    await expect(dlg).toBeVisible();

    const taskTitle = uniq("DashTask");
    await dlg.getByPlaceholder("e.g. Design login screen").fill(taskTitle);
    // The dialog has a "Project *" select — pick our seeded project.
    await dlg.locator("select").first().selectOption({ label: projectName });

    // Wait for the POST /api/tasks then for the dialog to dismiss.
    const post = page.waitForResponse(
      (r) => r.url().includes("/api/tasks") && r.request().method() === "POST" && r.ok(),
    );
    await dlg.getByRole("button", { name: /Create Task/i }).click();
    await post;
    await expect(dlg).toBeHidden({ timeout: 10_000 });

    await ctx.close();
  });
});
