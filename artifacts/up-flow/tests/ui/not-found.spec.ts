import { test, expect } from "@playwright/test";
import { requireChromiumOrSkip } from "./_ui-helpers";

/**
 * Visiting an unknown route should render our styled `not-found.tsx`,
 * not Next.js's default 404, and offer a way back to the dashboard.
 */
test.describe("404 page", () => {
  requireChromiumOrSkip();

  test("renders the styled not-found panel with a way home", async ({
    page,
  }) => {
    const res = await page.goto("/this-route-definitely-does-not-exist");
    // Next renders the closest not-found.tsx with HTTP 404.
    expect(res?.status()).toBe(404);

    await expect(page.getByTestId("not-found")).toBeVisible();
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
    // The "Back to dashboard" link must point at "/".
    const home = page.getByRole("link", { name: /back to dashboard/i });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute("href", "/");
  });
});
