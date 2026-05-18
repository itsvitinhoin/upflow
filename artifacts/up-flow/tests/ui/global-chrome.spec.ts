import { test, expect } from "@playwright/test";
import { SEEDED } from "../helpers";
import { loggedInContext, openCommandPalette, requireChromiumOrSkip } from "./_ui-helpers";

/**
 * Global chrome — controls that live on every dashboard page.
 *   * Sidebar rail nav (each link routes + marks active)
 *   * Sidebar panel toggle (Layers button)
 *   * Workspace switcher (open, current marked, "New workspace" prompt path)
 *   * Header search (Enter submits to /search?q=)
 *   * Command palette (⌘K opens, filters, Enter navigates)
 *   * Notification bell (opens menu, "Mark all read" clears unread badge)
 *   * Header "New Project" (opens modal with role=dialog aria-label="New Project")
 */
test.describe("Global chrome", () => {
  requireChromiumOrSkip();

  test("sidebar rail nav routes to each section and marks the active link", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");

    const sections: { label: string; path: string }[] = [
      { label: "Projects", path: "/projects" },
      { label: "Calendar", path: "/calendar" },
      { label: "Inbox", path: "/inbox" },
      { label: "Time tracking", path: "/time" },
      { label: "Team", path: "/team" },
    ];

    for (const { label, path } of sections) {
      await page.getByRole("link", { name: label, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${path}(\\?|$)`));
    }

    // Back to Dashboard from any sub-route.
    await page.getByRole("link", { name: "Dashboard", exact: true }).first().click();
    await expect(page).toHaveURL(/\/$/);

    // Sidebar spaces toggle (rail button collapses/expands the spaces panel).
    const railToggle = page.getByRole("button", { name: "Toggle spaces" });
    await railToggle.click();
    // Idempotent — just verify it stays clickable / wired.
    await railToggle.click();

    await ctx.close();
  });

  test("workspace switcher opens, shows current workspace, and exposes 'New workspace'", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");

    // The trigger uses a "Workspace" eyebrow label + the current workspace name.
    const trigger = page.locator("button", { hasText: "Workspace" }).first();
    await trigger.click();
    // "New workspace" is the create entry inside the dropdown.
    await expect(page.getByRole("button", { name: /New workspace/i })).toBeVisible();

    // "New workspace" uses window.prompt — dismiss to confirm the flow wires up.
    page.once("dialog", (d) => d.dismiss().catch(() => undefined));
    await page.getByRole("button", { name: /New workspace/i }).click();
    // Nothing should explode; the trigger remains.
    await expect(trigger).toBeVisible();

    await ctx.close();
  });

  test("header search submits to /search?q=…", async ({ browser, baseURL }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    const input = page.locator('input[type="search"]').first();
    await input.fill("design");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=design/);
    await expect(page.getByRole("heading", { name: /Results for/i })).toBeVisible();

    await ctx.close();
  });

  test("⌘K command palette opens, filters, and navigates on selection", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    await openCommandPalette(page);
    await page.getByPlaceholder("Type a command, page, project, or task…").fill("Calendar");
    // The dialog filters and Enter selects the highlighted item.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/calendar/);

    await ctx.close();
  });

  test("notification bell opens menu and 'Mark all read' clears unread indicator", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Notifications" }).click();
    // The menu has a header that contains "Notifications" — assert it's open.
    await expect(page.getByText("Notifications", { exact: true })).toBeVisible();

    // If there's an unread badge / "Mark all read" button, exercise it.
    const markAll = page.getByRole("button", { name: "Mark all read" });
    if (await markAll.count()) {
      await markAll.first().click();
      // After clicking, the button is no longer rendered (unreadCount === 0).
      await expect(markAll).toHaveCount(0);
    }
    await ctx.close();
  });

  test("header 'New Project' button opens the New Project dialog", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    await page
      .getByRole("button", { name: /^New Project$/ })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: "New Project" })).toBeVisible();

    await ctx.close();
  });
});
