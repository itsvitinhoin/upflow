import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load `.env.local` so the test runner sees TEST_LOGIN_TOKEN without having
// to re-export it manually. The Next.js dev server loads the same file.
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
 * The dev server is normally started by the Replit workflow
 * `artifacts/up-flow: web`. We reuse it instead of spawning a duplicate. If
 * you're running tests locally without that workflow, set
 * `PLAYWRIGHT_START_SERVER=1` to have Playwright start it for you.
 */
const startServer = process.env.PLAYWRIGHT_START_SERVER === "1";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: startServer
    ? {
        command: `pnpm --filter @workspace/up-flow run dev`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          PORT: port,
        },
      }
    : undefined,
});
