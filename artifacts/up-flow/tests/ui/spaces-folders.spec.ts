import { expect, test } from "@playwright/test";
import { SEEDED, uniq } from "../helpers";
import {
  createTaskViaApi,
  loggedInContext,
  requireChromiumOrSkip,
} from "./_ui-helpers";

test.describe("Spaces and folders containers", () => {
  requireChromiumOrSkip();

  test("spaces and folders show containers, while tasks stay inside lists", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const api = ctx.request;

    const spaceName = uniq("ContainerSpace");
    const folderName = uniq("ContainerFolder");
    const directListName = uniq("DirectList");
    const folderListName = uniq("FolderList");
    const taskTitle = uniq("HiddenTask");

    const space = await (
      await api.post("/api/spaces", { data: { name: spaceName } })
    ).json();
    const folder = await (
      await api.post("/api/folders", {
        data: { name: folderName, space_id: space.id },
      })
    ).json();
    await api.post("/api/projects", {
      data: { name: directListName, space_id: space.id },
    });
    const folderList = await (
      await api.post("/api/projects", {
        data: {
          name: folderListName,
          space_id: space.id,
          folder_id: folder.id,
        },
      })
    ).json();
    await createTaskViaApi(ctx, folderList.id, taskTitle);

    const page = await ctx.newPage();
    const spaceLoaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/spaces/${space.id}` &&
        response.ok(),
      { timeout: 30_000 },
    );
    await page.goto(`/spaces/${space.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await spaceLoaded;

    const main = page.locator("main");
    await expect(
      main.getByRole("heading", { name: spaceName, exact: true }),
    ).toBeVisible();
    const sidebar = page.locator("aside").first();
    await expect(
      sidebar.getByRole("link", { name: folderName, exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: directListName, exact: true }),
    ).toBeVisible();
    await expect(main.getByText(taskTitle)).toHaveCount(0);

    const folderLoaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/folders/${folder.id}` &&
        response.ok(),
      { timeout: 30_000 },
    );
    await sidebar.getByRole("link", { name: folderName, exact: true }).click();
    await folderLoaded;
    await expect(page).toHaveURL(new RegExp(`/folders/${folder.id}(\\?|$)`));

    const folderMain = page.locator("main");
    await expect(
      folderMain.getByRole("heading", { name: folderName, exact: true }),
    ).toBeVisible();
    await expect(
      folderMain.getByRole("link", { name: folderListName, exact: true }),
    ).toBeVisible();
    await expect(folderMain.getByText(taskTitle)).toHaveCount(0);
    await expect(folderMain.getByText(directListName)).toHaveCount(0);

    await ctx.close();
  });
});
