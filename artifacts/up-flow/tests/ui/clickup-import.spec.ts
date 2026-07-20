import { expect, test } from "@playwright/test";
import { SEEDED } from "../helpers";
import { loggedInContext, requireChromiumOrSkip } from "./_ui-helpers";

const workspace = { id: "up-agency", name: "UP AGENCY" };
const hierarchy = {
  items: [
    {
      space: { id: "creative", name: "Criativos & Design" },
      lists: [{ id: "creative-list", name: "Creative requests" }],
      folders: [
        {
          id: "brand-folder",
          name: "Brand work",
          lists: [{ id: "brand-list", name: "Brand campaigns" }],
        },
      ],
    },
  ],
};

async function stubWorkspaces(page: import("@playwright/test").Page) {
  await page.route("**/api/admin/imports/clickup/workspaces", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ teams: [workspace] }),
    });
  });
}

test.describe("ClickUp migration", () => {
  requireChromiumOrSkip();

  test("loads spaces and lists after choosing a ClickUp workspace", async ({
    browser,
    baseURL,
  }) => {
    const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await context.newPage();
    await stubWorkspaces(page);
    await page.route("**/api/admin/imports/clickup/hierarchy", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({
        source_workspace_id: workspace.id,
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(hierarchy),
      });
    });

    await page.goto("/admin/imports/clickup");
    const workspaceSelect = page.getByLabel("ClickUp workspace");
    await expect(workspaceSelect.locator("option")).toHaveCount(2);
    await workspaceSelect.selectOption(workspace.id);

    const loadButton = page.getByRole("button", {
      name: "Load spaces and lists",
    });
    await loadButton.click();

    await expect(
      page.getByRole("heading", { name: "Criativos & Design" }),
    ).toBeVisible();
    await expect(page.getByLabel("Creative requests")).toBeVisible();
    await expect(page.getByLabel("Brand campaigns")).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "Select the lists to include",
    );

    await context.close();
  });

  test("shows a retryable error when the ClickUp hierarchy request fails", async ({
    browser,
    baseURL,
  }) => {
    const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await context.newPage();
    await stubWorkspaces(page);
    await page.route("**/api/admin/imports/clickup/hierarchy", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "ClickUp connection is unavailable." }),
      });
    });

    await page.goto("/admin/imports/clickup");
    await page.getByLabel("ClickUp workspace").selectOption(workspace.id);
    const loadButton = page.getByRole("button", {
      name: "Load spaces and lists",
    });
    await loadButton.click();

    await expect(page.locator("p[role='alert']")).toContainText(
      "Could not load spaces and lists. ClickUp connection is unavailable.",
    );
    await expect(loadButton).toBeEnabled();

    await context.close();
  });
});
