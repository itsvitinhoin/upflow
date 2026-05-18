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
      const link = page.getByRole("link", { name: label, exact: true }).first();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${path}(\\?|$)`));
      // Active-state indicator: rail.tsx renders a `<span>` dot inside the
      // active link only — `link > span` count==1 confirms the active marker.
      await expect(link.locator("span")).toHaveCount(1);
    }

    // Back to Dashboard from any sub-route, and verify its active dot too.
    const dash = page.getByRole("link", { name: "Dashboard", exact: true }).first();
    await dash.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(dash.locator("span")).toHaveCount(1);

    // Sidebar spaces toggle (rail button collapses/expands the spaces panel).
    // aria-pressed is bound to the panelOpen state, so it must flip on click.
    const railToggle = page.getByRole("button", { name: "Toggle spaces" });
    const initialPressed = await railToggle.getAttribute("aria-pressed");
    await railToggle.click();
    await expect(railToggle).not.toHaveAttribute("aria-pressed", initialPressed ?? "");
    await railToggle.click();
    await expect(railToggle).toHaveAttribute("aria-pressed", initialPressed ?? "");

    await ctx.close();
  });

  test("workspace switcher: open, switch to another workspace, then exercise 'New workspace'", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();

    // Stub the workspace list/switch endpoints so the test is hermetic and
    // doesn't depend on multi-workspace seed data. /switch returns ok; the
    // component then calls window.location.reload() — we intercept that by
    // observing the POST instead of the navigation.
    await page.route("**/api/workspaces", async (route, req) => {
      if (req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            workspaces: [
              { id: "w1", name: "Primary", slug: "primary", role: "owner" },
              { id: "w2", name: "Secondary", slug: "secondary", role: "admin" },
            ],
            current_workspace_id: "w1",
            current_role: "owner",
          }),
        });
        return;
      }
      // POST → create workspace
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "w3" }),
      });
    });
    await page.route("**/api/workspaces/switch", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/");
    const trigger = page.locator("button", { hasText: "Workspace" }).first();
    // Wait for the stubbed list to load (current name "Primary" appears).
    await expect(trigger).toContainText("Primary");
    await trigger.click();

    // Both workspaces are listed. Click "Secondary" and assert the switch
    // POST fires — the component then reloads (which our stub still satisfies).
    const switched = page.waitForResponse(
      (r) => r.url().includes("/api/workspaces/switch") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: /^Secondary/ }).click();
    await switched;

    // Reopen and exercise the "New workspace" entry — uses window.prompt;
    // dismiss to confirm the path is wired but doesn't proceed.
    await page.goto("/");
    await page.locator("button", { hasText: "Workspace" }).first().click();
    page.once("dialog", (d) => d.dismiss().catch(() => undefined));
    await page.getByRole("button", { name: /New workspace/i }).click();
    await expect(page.locator("button", { hasText: "Workspace" }).first()).toBeVisible();

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

    // Stub the notifications endpoint so we deterministically have unread
    // items — the "Mark all read" button is only rendered when unreadCount>0.
    // The header component fetches from `/api/notifications` and PATCHes
    // per-item at `/api/notifications/:id`.
    await page.route("**/api/notifications", async (route, req) => {
      if (req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              { id: "n1", title: "Hi", body: "Test", read: false, created_at: new Date().toISOString() },
              { id: "n2", title: "Yo", body: "Test", read: false, created_at: new Date().toISOString() },
            ],
            nextCursor: null,
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
    await page.route("**/api/notifications/*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByText("Notifications", { exact: true })).toBeVisible();

    // With the stub above we *must* see "Mark all read"; clicking it flips
    // all to read and the button disappears.
    const markAll = page.getByRole("button", { name: "Mark all read" });
    await expect(markAll).toBeVisible();
    await markAll.click();
    await expect(markAll).toHaveCount(0);

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
