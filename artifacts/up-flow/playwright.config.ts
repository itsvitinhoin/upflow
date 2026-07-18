import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load `.env.local` so the test runner sees TEST_LOGIN_TOKEN without having
// to re-export it manually. The Next.js server loads the same file locally.
const envFile = resolve(__dirname, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    if (process.env[m[1]] !== undefined) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
}

const port = process.env.PORT || "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${port}`;

/**
 * The dev server is normally started by the local web workflow. We reuse it
 * instead of spawning a duplicate. Set `PLAYWRIGHT_START_SERVER=1` to have
 * Playwright start one. CI can set `PLAYWRIGHT_SERVER_MODE=production` to
 * run against a previously built production server.
 */
const startServer = process.env.PLAYWRIGHT_START_SERVER === "1";
const isCi = process.env.CI === "true";
const serverMode =
  process.env.PLAYWRIGHT_SERVER_MODE === "production" ? "start" : "dev";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  // CI runs against a production server; local iteration remains quick on
  // the development server. Keep enough room for a cold release process.
  timeout: isCi ? 90_000 : 60_000,
  expect: { timeout: isCi ? 30_000 : 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Keep local feedback fast while allowing a cold release process enough
    // time to start and serve its first requests.
    actionTimeout: isCi ? 30_000 : 10_000,
    navigationTimeout: isCi ? 60_000 : 15_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: startServer
    ? {
        command: `pnpm --filter @workspace/up-flow run ${serverMode}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          PORT: port,
        },
      }
    : undefined,
});
