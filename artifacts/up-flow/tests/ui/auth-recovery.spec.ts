import { test, expect } from "@playwright/test";
import { requireChromiumOrSkip } from "./_ui-helpers";

/**
 * Forgot-password + reset-link flow.
 *
 * The actual mail delivery is mocked out in the API tests; here we just
 * verify the public pages render, submit, and link to each other so the
 * recovery flow is reachable from /login without auth.
 */
test.describe("Password recovery pages", () => {
  requireChromiumOrSkip();

  test('login shows a "Forgot password?" link that opens /auth/forgot', async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.goto("/login");

    const link = page.getByRole("link", { name: "Forgot password?" });
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL(/\/auth\/forgot$/);
    await expect(
      page.getByRole("heading", { name: "Forgot password?" }),
    ).toBeVisible();

    await ctx.close();
  });

  test("submitting /forgot shows the confirmation panel (neutral response)", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.goto("/auth/forgot");

    await page.getByPlaceholder("you@company.com").fill("nobody@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(
      page.getByText(/a password\s+reset link is on its way/i),
    ).toBeVisible();
    await expect(page.getByText("nobody@example.com")).toBeVisible();

    await ctx.close();
  });

  test("/reset without a recovery hash shows an invalid-link panel", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.goto("/auth/reset");

    await expect(
      page.getByText(/reset link is invalid or has expired/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Request a new link" }),
    ).toBeVisible();

    await ctx.close();
  });
});
