import { test, expect, chromium } from "@playwright/test";
import { SEEDED, loginAs } from "./helpers";

/**
 * Minimal UI smoke: the bits the API can't speak to (Next.js page renders
 * for an authenticated user). Skips gracefully when no browser is
 * available (e.g. the Replit Nix sandbox doesn't ship glib by default —
 * see `replit.md`).
 */
test.describe("Up Flow smoke (UI)", () => {
  test.beforeAll(async () => {
    try {
      const browser = await chromium.launch();
      await browser.close();
    } catch (err) {
      test.skip(
        true,
        `Skipping UI smoke — Chromium failed to launch: ${(err as Error).message.split("\n")[0]}`,
      );
    }
  });

  test("dashboard renders for a logged-in admin", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    await loginAs(context, SEEDED.admin.email);

    const page = await context.newPage();
    const resp = await page.goto("/");
    expect(resp?.status(), "dashboard returns 2xx").toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/login(\?|$)/);

    // Some visible chrome (the app shell) must render — we don't pin a
    // specific selector beyond "the body has content" to keep the test
    // resilient to design tweaks.
    const text = (await page.locator("body").innerText()).trim();
    expect(text.length).toBeGreaterThan(0);

    await context.close();
  });
});
