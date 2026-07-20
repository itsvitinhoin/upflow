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

  test("restores a running migration job with failed lists after a page refresh", async ({
    browser,
    baseURL,
  }) => {
    const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await context.newPage();
    await stubWorkspaces(page);
    await page.route("**/api/admin/imports/clickup/jobs", async (route) => {
      expect(route.request().method()).toBe("GET");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "existing-job",
              status: "running",
              cursor: 14,
              total: 181,
              imported: 0,
              failed: 14,
              selected_source_ids: Array.from({ length: 14 }, (_, index) => ({
                space_id: "creative",
                list_id: `list-${index}`,
              })),
            },
          ],
        }),
      });
    });

    await page.goto("/admin/imports/clickup");

    await expect(page.getByRole("heading", { name: "Migration job" })).toBeVisible();
    await expect(page.getByText("14 of 14 selected lists processed.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry failed lists" })).toBeVisible();

    await context.close();
  });

  test("refreshes the sidebar and links to the imported space on completion", async ({
    browser,
    baseURL,
  }) => {
    const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await context.newPage();
    await page.addInitScript(() => {
      (window as typeof window & { __sidebarRefreshes?: number }).__sidebarRefreshes = 0;
      window.addEventListener("upflow:sidebar-refresh", () => {
        const state = window as typeof window & { __sidebarRefreshes?: number };
        state.__sidebarRefreshes = (state.__sidebarRefreshes ?? 0) + 1;
      });
    });
    await stubWorkspaces(page);
    await page.route("**/api/admin/imports/clickup/jobs", async (route) => {
      expect(route.request().method()).toBe("GET");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "running-job",
              status: "running",
              cursor: 13,
              total: 14,
              imported: 170,
              failed: 0,
              selected_source_ids: Array.from({ length: 14 }, (_, index) => ({
                space_id: "creative",
                list_id: `list-${index}`,
              })),
            },
          ],
        }),
      });
    });
    await page.route("**/api/admin/imports/clickup/jobs/running-job/resume", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "running-job",
          status: "completed",
          cursor: 14,
          total: 14,
          imported: 183,
          failed: 0,
          selected_source_ids: Array.from({ length: 14 }, (_, index) => ({
            space_id: "creative",
            list_id: `list-${index}`,
          })),
          imported_spaces: [
            {
              id: "imported-creative-space",
              name: "Criativos & Design",
              selected_lists: 14,
            },
          ],
        }),
      });
    });

    await page.goto("/admin/imports/clickup");
    await page.getByRole("button", { name: "Resume next batch" }).click();

    await expect(page.getByRole("status")).toContainText("Migration complete");
    await expect(page.getByText("completed: 183 tasks imported")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Criativos & Design" }),
    ).toHaveAttribute("href", "/spaces/imported-creative-space");
    await expect(page.getByText("(14 selected lists)")).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as typeof window & { __sidebarRefreshes?: number }).__sidebarRefreshes,
      ),
    ).toBe(1);

    await context.close();
  });

  test("restores the latest completed migration with its imported-space link", async ({
    browser,
    baseURL,
  }) => {
    const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await context.newPage();
    await stubWorkspaces(page);
    await page.route("**/api/admin/imports/clickup/jobs", async (route) => {
      expect(route.request().method()).toBe("GET");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "completed-job",
              status: "completed",
              cursor: 14,
              total: 14,
              imported: 183,
              failed: 0,
              selected_source_ids: Array.from({ length: 14 }, (_, index) => ({
                space_id: "creative",
                list_id: `list-${index}`,
              })),
              imported_spaces: [
                {
                  id: "imported-creative-space",
                  name: "Criativos & Design",
                  selected_lists: 14,
                },
              ],
            },
          ],
        }),
      });
    });

    await page.goto("/admin/imports/clickup");

    await expect(page.getByRole("heading", { name: "Migration job" })).toBeVisible();
    await expect(page.getByText("completed: 183 tasks imported")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Criativos & Design" }),
    ).toHaveAttribute("href", "/spaces/imported-creative-space");

    await context.close();
  });

  test("synchronizes task statuses for a completed migration", async ({
    browser,
    baseURL,
  }) => {
    const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await context.newPage();
    await stubWorkspaces(page);
    await page.route("**/api/admin/imports/clickup/jobs", async (route) => {
      expect(route.request().method()).toBe("GET");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "completed-job",
              status: "completed",
              cursor: 14,
              total: 14,
              imported: 183,
              failed: 0,
              selected_source_ids: Array.from({ length: 14 }, (_, index) => ({
                space_id: "creative",
                list_id: `list-${index}`,
              })),
            },
          ],
        }),
      });
    });
    await page.route(
      "**/api/admin/imports/clickup/jobs/completed-job/sync-statuses",
      async (route) => {
        expect(route.request().method()).toBe("POST");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "completed-job",
            status: "completed",
            cursor: 14,
            total: 14,
            imported: 183,
            failed: 0,
            selected_source_ids: Array.from({ length: 14 }, (_, index) => ({
              space_id: "creative",
              list_id: `list-${index}`,
            })),
            report: {
              status_sync: {
                active: false,
                updated: 183,
                failed: 0,
                failures: [],
              },
            },
          }),
        });
      },
    );

    await page.goto("/admin/imports/clickup");
    await page.getByRole("button", { name: "Sync task statuses" }).click();

    await expect(page.getByRole("status")).toContainText(
      "183 task statuses and board stages synchronized.",
    );
    await expect(
      page.getByText("Task status sync: 183 tasks and board stages synchronized."),
    ).toBeVisible();

    await context.close();
  });

  test("restores an active job after a duplicate queue response", async ({
    browser,
    baseURL,
  }) => {
    const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await context.newPage();
    await stubWorkspaces(page);
    await page.route("**/api/admin/imports/clickup/hierarchy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(hierarchy),
      });
    });
    await page.route("**/api/admin/imports/clickup/preview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          lists: 1,
          tasks: 2,
          assignee_emails: [],
        }),
      });
    });

    let jobReads = 0;
    await page.route("**/api/admin/imports/clickup/jobs", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "An import is already running for this workspace",
          }),
        });
        return;
      }

      jobReads += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: jobReads === 1
            ? []
            : [{
                id: "existing-job",
                status: "running",
                cursor: 1,
                total: 1,
                imported: 0,
                failed: 0,
                selected_source_ids: [{
                  space_id: "creative",
                  list_id: "creative-list",
                }],
              }],
        }),
      });
    });

    await page.goto("/admin/imports/clickup");
    await page.getByLabel("ClickUp workspace").selectOption(workspace.id);
    await page.getByRole("button", { name: "Load spaces and lists" }).click();
    await page.getByLabel("Creative requests").check();
    await page.getByRole("button", { name: "Preview" }).click();
    await page.getByRole("button", { name: "Confirm and queue import" }).click();

    await expect(page.getByRole("heading", { name: "Migration job" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "The existing migration job has been restored below.",
    );
    await expect(
      page.getByRole("button", { name: "Confirm and queue import" }),
    ).toBeDisabled();

    await context.close();
  });

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
