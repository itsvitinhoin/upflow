import { test, expect } from "@playwright/test";
import { SEEDED, uniq } from "../helpers";
import {
  loggedInContext,
  openCommandPalette,
  requireChromiumOrSkip,
} from "./_ui-helpers";

/** Controls that live on every dashboard page. */
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
      await expect(link).toHaveAttribute("aria-current", "page");
    }

    const dash = page
      .getByRole("link", { name: "Dashboard", exact: true })
      .first();
    await dash.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(dash).toHaveAttribute("aria-current", "page");

    const railToggle = page.getByRole("button", {
      name: /^(Hide|Show) sidebar$/,
    }).first();
    const initialPressed = await railToggle.getAttribute("aria-pressed");
    await railToggle.click();
    await expect(railToggle).not.toHaveAttribute(
      "aria-pressed",
      initialPressed ?? "",
    );
    await railToggle.click();
    await expect(railToggle).toHaveAttribute(
      "aria-pressed",
      initialPressed ?? "",
    );

    await ctx.close();
  });

  test("workspace switcher: open, switch to another workspace, then exercise 'New workspace'", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    const secondaryName = uniq("Secondary workspace");
    const created = await ctx.request.post("/api/workspaces", {
      data: { name: secondaryName },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Workspace options" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const switched = page.waitForResponse(
      (response) =>
        response.url().includes("/api/workspaces/switch") &&
        response.request().method() === "POST",
    );
    const reloaded = page.waitForNavigation({ waitUntil: "domcontentloaded" });
    await page.getByRole("button").filter({ hasText: secondaryName }).click();
    await switched;
    await reloaded;

    await page.getByRole("button", { name: "Workspace options" }).click();
    page.once("dialog", (dialog) => dialog.dismiss().catch(() => undefined));
    await page.getByRole("button", { name: /New workspace/i }).click();
    await expect(
      page.getByRole("button", { name: "Workspace options" }),
    ).toBeVisible();

    await ctx.close();
  });

  test("header search submits to /search?q=…", async ({ browser, baseURL }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.goto("/");
    const input = page
      .getByRole("form", { name: /^Search / })
      .getByRole("searchbox");
    await input.fill("design");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=design/);
    await expect(
      page.getByRole("heading", { name: /Results for/i }),
    ).toBeVisible();

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
    await page
      .getByPlaceholder(/Type a command, page, project, or task/)
      .fill("Calendar");
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

    await page.route("**/api/notifications", async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: "n1",
                title: "Hi",
                body: "Test",
                read: false,
                created_at: new Date().toISOString(),
              },
              {
                id: "n2",
                title: "Yo",
                body: "Test",
                read: false,
                created_at: new Date().toISOString(),
              },
            ],
            nextCursor: null,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });
    await page.route("**/api/notifications/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(
      page.getByText("Notifications", { exact: true }),
    ).toBeVisible();

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
    await expect(
      page.getByRole("dialog", { name: "New Project" }),
    ).toBeVisible();

    await ctx.close();
  });
});
