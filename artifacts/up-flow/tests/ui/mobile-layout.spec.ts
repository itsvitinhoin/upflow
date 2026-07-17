import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { SEEDED, uniq } from "../helpers";
import {
  createProjectViaApi,
  createTaskViaApi,
  loggedInContext,
  requireChromiumOrSkip,
} from "./_ui-helpers";

const MOBILE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
];
const COLD_ROUTE_TIMEOUT = process.env.CI ? 60_000 : 30_000;

async function expectNoPageOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    scrollWidth,
    "page should not create horizontal document scroll",
  ).toBeLessThanOrEqual(innerWidth + 1);
}

async function expectFitsViewport(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} should be visible`).toBeTruthy();
  if (!box) return;
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  if (!viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function createSpaceViaApi(
  ctx: BrowserContext,
  name: string,
): Promise<string> {
  const res = await ctx.request.post("/api/spaces", { data: { name } });
  expect(res.ok(), `create space failed: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createFolderViaApi(
  ctx: BrowserContext,
  spaceId: string,
  name: string,
): Promise<string> {
  const res = await ctx.request.post("/api/folders", {
    data: { name, space_id: spaceId },
  });
  expect(res.ok(), `create folder failed: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

test.describe("Mobile responsive layout", () => {
  requireChromiumOrSkip();

  test("dashboard shell keeps sidebar toggle separate from search on mobile", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeVisible();
    const searchbox = page
      .getByRole("form", { name: /^Search / })
      .getByRole("searchbox");
    await expect(searchbox).toBeVisible();

    const button = await page
      .getByRole("button", { name: "Open navigation" })
      .boundingBox();
    const search = await searchbox.boundingBox();
    expect(button).toBeTruthy();
    expect(search).toBeTruthy();
    if (button && search) {
      expect(button.x + button.width).toBeLessThanOrEqual(search.x);
    }

    await expectNoPageOverflow(page);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("button", { name: "Close navigation" }),
    ).toBeVisible();
    await expectFitsViewport(page, "aside.fixed:visible");
    await page.getByRole("button", { name: "Close navigation" }).click();
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeVisible();
    await ctx.close();
  });

  test("primary dashboard routes do not create page-level horizontal overflow", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(ctx, uniq("MobileProject"));
    await createTaskViaApi(ctx, projectId, uniq("MobileTask"));
    const spaceId = await createSpaceViaApi(ctx, uniq("MobileSpace"));
    const folderId = await createFolderViaApi(
      ctx,
      spaceId,
      uniq("MobileFolder"),
    );

    const companyRes = await ctx.request.post("/api/companies", {
      data: {
        name: uniq("MobileClient"),
        service_type: "Creative",
        plan_name: "Growth",
      },
    });
    const company = companyRes.ok()
      ? ((await companyRes.json()) as { id: string })
      : null;

    const routes = [
      "/",
      "/team",
      "/projects",
      `/projects/${projectId}`,
      "/calendar",
      "/clients",
      company ? `/clients/${company.id}` : null,
      `/spaces/${spaceId}`,
      `/folders/${folderId}`,
      "/time",
      "/inbox",
    ].filter(Boolean) as string[];

    for (const viewport of MOBILE_VIEWPORTS) {
      const page = await ctx.newPage();
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(route, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await expect(page.locator("body")).toBeVisible();
        await expectNoPageOverflow(page);
      }
      await page.close();
    }

    await ctx.close();
  });

  test("project board and task sheet remain usable on phone-sized screens", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const projectId = await createProjectViaApi(
      ctx,
      uniq("MobileBoardProject"),
    );
    const taskTitle = uniq("MobileBoardTask");
    await createTaskViaApi(ctx, projectId, taskTitle);

    const page = await ctx.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    const tasksLoaded = page.waitForResponse(
      (response) => {
        const url = new URL(response.url());
        return (
          url.pathname === "/api/tasks" &&
          url.searchParams.get("project_id") === projectId &&
          response.ok()
        );
      },
      { timeout: COLD_ROUTE_TIMEOUT },
    );
    const usersLoaded = page.waitForResponse(
      (response) => {
        const url = new URL(response.url());
        return url.pathname === "/api/users" && response.ok();
      },
      { timeout: COLD_ROUTE_TIMEOUT },
    );
    await page.goto(`/projects/${projectId}`, {
      waitUntil: "domcontentloaded",
      timeout: COLD_ROUTE_TIMEOUT,
    });
    // The project page does not publish its task state until the follow-up users
    // request has completed, so wait for both parts of its loadData sequence.
    await Promise.all([tasksLoaded, usersLoaded]);
    await expectNoPageOverflow(page);

    const boardButton = page.getByRole("button", { name: /Board/i }).first();
    if (await boardButton.isVisible().catch(() => false)) {
      await boardButton.click();
    }

    await expect(page.getByText(taskTitle).first()).toBeVisible();
    await expectNoPageOverflow(page);
    await page.getByText(taskTitle).first().click();

    await expect(
      page.locator(`input[value="${taskTitle}"]`).first(),
    ).toBeVisible();
    await expectFitsViewport(page, "div.fixed.right-0.top-0.z-50");
    await expectNoPageOverflow(page);
    await ctx.close();
  });

  test("global create and invite dialogs fit inside mobile viewport", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    await page
      .getByRole("button", { name: /^New Project$/ })
      .first()
      .click();
    await expect(
      page.getByRole("dialog", { name: "New Project" }),
    ).toBeVisible();
    await expectFitsViewport(page, '[role="dialog"]');
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.goto("/team");
    await page.getByRole("button", { name: /Invite users/i }).first().click();
    await expect(
      page.getByRole("heading", {
        name: "Invite real users to Up Flow",
        level: 2,
      }),
    ).toBeVisible();
    await expectFitsViewport(page, "form:has(h2)");
    await ctx.close();
  });
});
