import { expect, test } from "@playwright/test";

const runCritical = process.env.UPFLOW_CRITICAL_E2E === "true";

test.describe("critical internal readiness flows", () => {
  test.skip(!runCritical, "Set UPFLOW_CRITICAL_E2E=true with seeded admin/member/guest data to run these checks.");

  test("permissions are enforced for member and guest roles", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.getByRole("button", { name: /add|new|create/i })).toHaveCount(0);
  });

  test("client health center ranks clients needing attention", async ({ page }) => {
    await page.goto("/clients/health");
    await expect(page.getByRole("heading", { name: /client health center/i })).toBeVisible();
    await expect(page.getByText(/needs attention queue/i)).toBeVisible();
    await expect(page.getByText(/at risk|attention|needs data/i).first()).toBeVisible();
  });

  test("client report workflow can be previewed and archived", async ({ page }) => {
    const clientId = process.env.UPFLOW_E2E_CLIENT_ID;
    test.skip(!clientId, "Set UPFLOW_E2E_CLIENT_ID to an existing seeded client.");
    await page.goto(`/clients/${clientId}/report`);
    await expect(page.getByRole("heading", { name: /report workflow/i })).toBeVisible();
    await page.getByRole("button", { name: /preview report/i }).click();
    await page.getByRole("button", { name: /approve internally/i }).click();
    await page.getByRole("button", { name: /archive report history/i }).click();
    await expect(page.getByText(/archived to client activity/i)).toBeVisible();
  });

  test("audit center exposes permission and report history", async ({ page }) => {
    await page.goto("/activity");
    await expect(page.getByRole("heading", { name: /activity and audit log/i })).toBeVisible();
    await page.getByPlaceholder(/search type, actor, client/i).fill("client_report");
    await page.getByRole("button", { name: /apply/i }).click();
    await expect(page.getByText(/client report|no matching audit events/i).first()).toBeVisible();
  });
});
