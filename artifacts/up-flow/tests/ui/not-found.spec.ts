import { test, expect } from "@playwright/test";
import { SEEDED } from "../helpers";
import { loggedInContext, requireChromiumOrSkip } from "./_ui-helpers";

/**
 * Visiting an unknown route should render our styled `not-found.tsx`,
 * not Next.js's default 404, and offer a way back to the dashboard.
 */
test.describe("404 page", () => {
  requireChromiumOrSkip();

  test("renders the styled not-found panel with a way home", async ({
    browser,
    baseURL,
  }) => {
    const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const page = await context.newPage();
    await page.goto("/this-route-definitely-does-not-exist");
    // With Next.js streaming, the custom not-found UI can be returned with a
    // successful shell response. The rendered recovery experience is the contract.

    await expect(page.getByTestId("not-found")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /page not found/i }),
    ).toBeVisible();
    // The "Back to dashboard" link must point at "/".
    const home = page.getByRole("link", { name: /back to dashboard/i });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("href", "/");
    await context.close();
  });
});
