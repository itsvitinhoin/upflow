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
    await page.route("**/api/auth/forgot", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({
        email: "nobody@example.com",
      });
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ status: "accepted" }),
      });
    });
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

  test("opaque confirmation state is scrubbed and resolved only after Continue", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    const state = "opaque-recovery-state";
    let continuationRequests = 0;

    await page.route("**/api/auth/forgot/continue", async (route) => {
      continuationRequests += 1;
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({ state });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ actionLink: "https://recovery.example.test/verified" }),
      });
    });
    await page.route("https://recovery.example.test/verified", async (route) => {
      await route.fulfill({ status: 200, body: "verified" });
    });

    await page.goto(`/auth/reset/confirm?state=${state}`);
    await expect(page).toHaveURL(/\/auth\/reset\/confirm$/);
    await expect(
      page.getByRole("button", { name: "Continue to reset password" }),
    ).toBeVisible();
    expect(continuationRequests).toBe(0);

    await page.getByRole("button", { name: "Continue to reset password" }).click();
    await expect(page).toHaveURL("https://recovery.example.test/verified");
    expect(continuationRequests).toBe(1);

    await ctx.close();
  });

  test("temporary confirmation failures keep the reset link retryable", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    let continuationRequests = 0;

    await page.route("**/api/auth/forgot/continue", async (route) => {
      continuationRequests += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporarily unavailable" }),
      });
    });

    await page.goto("/auth/reset/confirm?state=retryable-state");
    const continueButton = page.getByRole("button", { name: "Continue to reset password" });
    await continueButton.click();

    await expect(page.locator("p[role='alert']")).toHaveText(
      "We couldn't open the reset form. Please try again.",
    );
    await expect(continueButton).toBeEnabled();
    await expect(page).toHaveURL(/\/auth\/reset\/confirm$/);
    await expect(page.getByText(/reset link is invalid or has expired/i)).not.toBeVisible();

    await continueButton.click();
    await expect.poll(() => continuationRequests).toBe(2);

    await ctx.close();
  });
});
