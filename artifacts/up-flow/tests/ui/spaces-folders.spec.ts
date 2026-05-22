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
    await page.goto(`/spaces/${space.id}`);

    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: spaceName })).toBeVisible();
    await expect(main.getByRole("link", { name: folderName, exact: true })).toBeVisible();
    await expect(main.getByRole("link", { name: directListName, exact: true })).toBeVisible();
    await expect(main.getByText("Recent activity")).toHaveCount(0);
    await expect(main.getByText("Completed")).toHaveCount(0);
    await expect(main.getByText(taskTitle)).toHaveCount(0);

    await page
      .locator("aside")
      .first()
      .getByRole("link", { name: folderName, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/folders/${folder.id}(\\?|$)`));

    const folderMain = page.locator("main");
    await expect(folderMain.getByRole("heading", { name: folderName })).toBeVisible();
    await expect(
      folderMain.getByRole("link", { name: folderListName, exact: true }),
    ).toBeVisible();
    await expect(folderMain.getByText(taskTitle)).toHaveCount(0);
    await expect(folderMain.getByText(directListName)).toHaveCount(0);

    await ctx.close();
  });
});
