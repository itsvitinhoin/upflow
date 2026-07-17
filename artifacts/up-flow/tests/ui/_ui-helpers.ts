import {
  chromium,
  test,
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { loginAs } from "../helpers";

/**
 * Skip-when-no-Chromium guard. Throws hard in CI (where Chromium MUST be
 * installable) but skips the whole describe block locally — e.g. the Replit
 * Nix sandbox doesn't ship the glib system libs Chromium needs.
 *
 * Reuses the pattern from the original `ui.spec.ts` so local runs stay green
 * without false failures.
 */
export function requireChromiumOrSkip(): void {
  test.beforeAll(async () => {
    try {
      const b = await chromium.launch();
      await b.close();
    } catch (err) {
      if (process.env.CI) throw err;
      test.skip(
        true,
        `Skipping UI spec — Chromium failed to launch: ${(err as Error).message.split("\n")[0]}`,
      );
    }
  });
}

/**
 * Build a Playwright BrowserContext already signed in as `email`. The cookie
 * is set by the dev-only `/api/auth/test-login` route; same path the API
 * smoke specs use.
 */
export async function loggedInContext(
  browser: Browser,
  baseURL: string | undefined,
  email: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL });
  // Keep unrelated seeded notifications from opening the assistant popup on
  // top of controls under test. Specs that cover notifications register a
  // page-level route after this and therefore override the empty default.
  await context.route("**/api/notifications", async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], nextCursor: null }),
    });
  });
  await loginAs(context, email);
  return context;
}

/** Open the global ⌘K command palette from any page. */
export async function openCommandPalette(page: Page): Promise<void> {
  // The palette shortcut is registered in a client effect. Waiting for the
  // dashboard readiness marker ensures hydration has installed that listener.
  await expect(
    page.locator('main[data-dashboard-ready="true"]'),
  ).toBeVisible({ timeout: 30_000 });
  // Click body first so the keypress isn't swallowed by an input.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+k");
  // Cmdk renders a dialog with a search input.
  await expect(
    page
      .getByRole("dialog")
      .getByPlaceholder(/Type a command, page, project, or task/),
  ).toBeVisible({ timeout: 30_000 });
}

/** Seed a fresh workspace project via the JSON API and return its id. */
export async function createProjectViaApi(
  ctx: APIRequestContext | BrowserContext,
  name: string,
  options?: Record<string, unknown>,
): Promise<string> {
  const req = "post" in ctx ? ctx : ctx.request;
  const res = await req.post("/api/projects", { data: { name, ...options } });
  expect(res.ok(), `create project failed: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

/** Seed a fresh task via the JSON API and return its id. */
export async function createTaskViaApi(
  ctx: APIRequestContext | BrowserContext,
  projectId: string,
  title: string,
  patch: Record<string, unknown> = {},
): Promise<string> {
  const req = "post" in ctx ? ctx : ctx.request;
  const res = await req.post("/api/tasks", {
    data: {
      title,
      project_id: projectId,
      status: "todo",
      priority: "medium",
      ...patch,
    },
  });
  expect(res.ok(), `create task failed: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

/** Return the id of the user authenticated in this browser/API context. */
export async function currentUserId(
  ctx: APIRequestContext | BrowserContext,
): Promise<string> {
  const req = "get" in ctx ? ctx : ctx.request;
  const res = await req.get("/api/auth/me");
  expect(res.ok(), `load current user failed: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}
