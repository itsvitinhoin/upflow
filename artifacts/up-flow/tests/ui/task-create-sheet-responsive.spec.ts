import { expect, test } from "@playwright/test";

import { SEEDED } from "../helpers";
import { loggedInContext, requireChromiumOrSkip } from "./_ui-helpers";

const cases = [
  { name: "desktop light", width: 1440, height: 900, theme: "light" },
  { name: "520px dark", width: 520, height: 820, theme: "dark" },
  { name: "mobile light", width: 390, height: 740, theme: "light" },
] as const;

test.describe("quick-first task creator responsive layout", () => {
  requireChromiumOrSkip();

  for (const layout of cases) {
    test(layout.name, async ({ browser, baseURL }, testInfo) => {
      const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
      await context.addInitScript((theme) => {
        localStorage.setItem("upflow.theme", theme);
        localStorage.setItem("upflow.language", "en");
      }, layout.theme);
      const page = await context.newPage();
      await page.setViewportSize({ width: layout.width, height: layout.height });
      await page.goto("/");

      await page.getByRole("button", { name: "Quick create" }).click();
      await page.getByRole("menuitem", { name: "Task", exact: true }).click();

      const sheet = page.getByRole("dialog", { name: "Create task" });
      const scroll = sheet.locator("[data-task-create-scroll]");
      const footer = sheet.locator("[data-task-create-footer]");
      await expect(sheet).toBeVisible();
      await expect(page.locator("html")).toHaveClass(new RegExp(`(^|\\s)${layout.theme}(\\s|$)`));

      const [sheetBox, scrollBox, footerBox] = await Promise.all([
        sheet.boundingBox(),
        scroll.boundingBox(),
        footer.boundingBox(),
      ]);
      expect(sheetBox).toBeTruthy();
      expect(scrollBox).toBeTruthy();
      expect(footerBox).toBeTruthy();
      expect(sheetBox!.x).toBeGreaterThanOrEqual(0);
      expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual(layout.width + 1);
      expect(scrollBox!.y + scrollBox!.height).toBeLessThanOrEqual(footerBox!.y + 1);
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(layout.height + 1);

      const horizontalOverflow = await sheet.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      await testInfo.attach(`task-create-${layout.name}.png`, {
        body: await sheet.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
      await context.close();
    });
  }
});
