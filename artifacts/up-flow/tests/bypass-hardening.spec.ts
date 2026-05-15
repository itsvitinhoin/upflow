import { test, expect, request } from "@playwright/test";
import { SEEDED, loginAs } from "./helpers";

/**
 * Hardening tests for the dev-only login bypass — proves the
 * bypass cannot be exercised without the secret token, and that
 * forged cookies don't grant resource access.
 */
test.describe("test-login bypass hardening", () => {
  test("POST /api/auth/test-login rejects an invalid token", async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const res = await ctx.post("/api/auth/test-login", {
      data: { email: SEEDED.admin.email, token: "not-the-real-token" },
    });
    expect(res.status(), "wrong token must 401").toBe(401);
    await ctx.dispose();
  });

  test("POST /api/auth/test-login requires both email and token", async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const res = await ctx.post("/api/auth/test-login", { data: {} });
    expect(res.status(), "missing fields must 400").toBe(400);
    await ctx.dispose();
  });

  test("a forged shape-valid cookie does not grant API access", async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        // base64url("admin@upflow.io") + "." + a fake signature of the right shape
        cookie: "upflow_test_user=YWRtaW5AdXBmbG93Lmlv.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    });
    const res = await ctx.get("/api/projects");
    expect(res.status(), "forged cookie must not be accepted by API").toBe(401);
    await ctx.dispose();
  });

  test("a forged shape-valid cookie does not cause a /login redirect loop", async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        cookie: "upflow_test_user=YWRtaW5AdXBmbG93Lmlv.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    });
    // /login must remain reachable (no auto-redirect to /) when the bypass
    // cookie is stale/forged — otherwise the dashboard layout's HMAC check
    // would bounce back to /login and create an infinite loop.
    const res = await ctx.get("/login", { maxRedirects: 0 });
    expect(res.status(), `/login should not redirect, got ${res.status()}`).toBeLessThan(300);
    await ctx.dispose();
  });

  test("logout clears the test-login cookie", async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    await loginAs(ctx, SEEDED.admin.email);

    // sanity: logged in
    const before = await ctx.get("/api/projects");
    expect(before.ok(), "authed before logout").toBeTruthy();

    await ctx.post("/api/auth/logout");

    const after = await ctx.get("/api/projects");
    expect(after.status(), "unauthed after logout").toBe(401);
    await ctx.dispose();
  });
});
