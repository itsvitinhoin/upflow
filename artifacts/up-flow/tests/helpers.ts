import { request, type APIRequestContext, type BrowserContext, expect } from "@playwright/test";

export const SEEDED = {
  admin: { email: "admin@upflow.io" },
  member: { email: "sarah@upflow.io" },
} as const;

/**
 * Sign a context in as a seeded user via the dev-only `/api/auth/test-login`
 * route. The route sets an httpOnly cookie that both the middleware and
 * `getAuthResult()` honor, so subsequent requests/page loads behave exactly
 * like a real Supabase session — minus the email/password round-trip.
 */
export async function loginAs(
  ctx: APIRequestContext | BrowserContext,
  email: string,
): Promise<void> {
  const token = process.env.TEST_LOGIN_TOKEN;
  if (!token) {
    throw new Error(
      "TEST_LOGIN_TOKEN must be set on the dev server AND in the test runner env",
    );
  }
  const req = "post" in ctx ? ctx : ctx.request;
  let failure = "no response";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await req.post("/api/auth/test-login", {
        data: { email, token },
      });
      if (res.ok()) return;
      failure = `${res.status()} ${await res.text()}`;
      if (res.status() < 500) break;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  expect(false, `test-login failed after 3 attempts: ${failure}`).toBeTruthy();
}

export async function logout(ctx: APIRequestContext | BrowserContext): Promise<void> {
  const req = "post" in ctx ? ctx : ctx.request;
  await req.post("/api/auth/logout").catch(() => undefined);
  if ("clearCookies" in ctx) await ctx.clearCookies();
}

/** Spin up a throwaway API context already signed in as `email`. */
export async function apiAs(baseURL: string, email: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL });
  await loginAs(ctx, email);
  return ctx;
}

export function uniq(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
