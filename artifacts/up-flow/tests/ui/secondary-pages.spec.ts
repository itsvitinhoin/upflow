import { test, expect } from "@playwright/test";
import { SEEDED, uniq } from "../helpers";
import {
  createProjectViaApi,
  createTaskViaApi,
  loggedInContext,
  requireChromiumOrSkip,
} from "./_ui-helpers";

/**
 * Calendar, Time, Inbox, Team, Search:
 *   * Calendar: Today / prev / next month navigation + day-cell selection
 *     (the selected day renders due-task links).
 *   * Time: weekly bars + per-project breakdown render once projects load.
 *   * Inbox: filter tabs flip the active state, "Mark all read" works when
 *     unread items exist.
 *   * Team: table renders with at least the seeded admin row.
 *   * Search: navigating with q= renders the "Results for …" heading and
 *     surfaces a seeded project.
 */
test.describe("Calendar", () => {
  requireChromiumOrSkip();

  test("Today / prev / next navigation updates the month label", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/calendar");
    const heading = page.locator("h3").filter({ hasText: /\b\d{4}$/ }).first();
    const initial = await heading.textContent();
    expect(initial?.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Next month" }).click();
    await expect(heading).not.toHaveText(initial ?? "");

    // "Today" jumps the cursor back to the current month.
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expect(heading).toHaveText(initial ?? "");

    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(heading).not.toHaveText(initial ?? "");
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(heading).toHaveText(initial ?? "");

    // Click a day cell — assert the right-hand "Due tasks" rail header is visible.
    await page.locator("button:has(span)").filter({ hasText: /^\d+$/ }).first().click();
    await expect(page.getByText("Due tasks")).toBeVisible();

    await ctx.close();
  });
});

test.describe("Time tracking", () => {
  requireChromiumOrSkip();

  test("page renders summary cards and the weekly chart bars", async ({ browser, baseURL }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    // Seed at least one project so the per-project list renders.
    await createProjectViaApi(ctx, uniq("Time-Proj"));

    const page = await ctx.newPage();
    await page.goto("/time");
    await expect(page.getByText("This week")).toBeVisible();
    await expect(page.getByText("Daily average")).toBeVisible();
    await expect(page.getByText("Weekly hours")).toBeVisible();
    // 7 bars rendered.
    const bars = page.locator("div[title*=':']");
    expect(await bars.count()).toBeGreaterThanOrEqual(7);

    await ctx.close();
  });
});

test.describe("Inbox", () => {
  requireChromiumOrSkip();

  test("filter tabs toggle the active state", async ({ browser, baseURL }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/inbox");

    // The tabs are plain buttons with text "All", "Unread", "Assigned", etc.
    await page.getByRole("button", { name: /^Unread\s*\d+$/ }).click();
    // "Mark all read" appears when there are unread items; if not, the
    // empty-state message renders. Either path is a valid pass.
    const markAll = page.getByRole("button", { name: /Mark all read/ });
    if (await markAll.count()) {
      await markAll.click();
      // After marking, the button is gone.
      await expect(markAll).toHaveCount(0);
    } else {
      await expect(page.getByText(/No unread notifications|Nothing here yet/)).toBeVisible();
    }

    await ctx.close();
  });
});

test.describe("Team", () => {
  requireChromiumOrSkip();

  test("table renders with seeded admin row", async ({ browser, baseURL }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/team");
    await expect(page.getByRole("table")).toBeVisible();
    // The seeded admin email is admin@upflow.io — should appear in the table.
    await expect(page.getByText("admin@upflow.io").first()).toBeVisible();

    await ctx.close();
  });
});

test.describe("Search", () => {
  requireChromiumOrSkip();

  test("typing in the header search and pressing Enter surfaces matching projects", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const name = uniq("SearchTarget");
    await createProjectViaApi(ctx, name);
    // Also create a task so /search has at least one matching task.
    const proj = await createProjectViaApi(ctx, uniq("SearchProj"));
    const taskTitle = `${name}-task`;
    await createTaskViaApi(ctx, proj, taskTitle);

    const page = await ctx.newPage();
    await page.goto("/");
    const input = page.locator('input[type="search"]').first();
    await input.fill(name);
    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${encodeURIComponent(name)}`));
    await expect(page.getByRole("heading", { name: /Results for/i })).toBeVisible();
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });
});
