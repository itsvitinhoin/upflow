import { expect, test } from "@playwright/test";
import { SEEDED } from "../helpers";
import { loggedInContext, requireChromiumOrSkip } from "./_ui-helpers";

type TeamMember = {
  id: string;
  email: string;
  workspace_role: string | null;
  workspace_status: string | null;
};

type Mapping = {
  service: string;
  backup_leader_ids: string[];
};

test.describe("Team backup owners", () => {
  requireChromiumOrSkip();

  test("selects two active backup owners, excludes the primary, and persists both", async ({
    browser,
    baseURL,
  }) => {
    const context = await loggedInContext(browser, baseURL, SEEDED.admin.email);
    const teamResponse = await context.request.get("/api/team/overview");
    expect(teamResponse.ok()).toBeTruthy();
    const team = (await teamResponse.json()) as { members: TeamMember[] };
    const primary = team.members.find((member) => member.email === SEEDED.admin.email);
    if (!primary) throw new Error("Seeded admin is missing from the Team overview");

    const backups = team.members
      .filter(
        (member) =>
          member.id !== primary.id &&
          member.workspace_status === "active" &&
          member.workspace_role !== "guest",
      )
      .slice(0, 2);
    const [firstBackup, secondBackup] = backups;
    if (!firstBackup || !secondBackup) {
      throw new Error("Two active, non-guest backup candidates are required for this test");
    }

    const mappingsResponse = await context.request.get("/api/service-leader-mapping");
    expect(mappingsResponse.ok()).toBeTruthy();
    const mappings = (await mappingsResponse.json()) as { items: Mapping[] };
    const service = mappings.items[0]?.service;
    if (!service) throw new Error("No onboarding department mapping is available");

    const page = await context.newPage();
    const mappingsLoaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/service-leader-mapping" && response.ok(),
    );
    await page.goto("/team", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await mappingsLoaded;

    const mappingPanel = page
      .locator("details")
      .filter({ has: page.getByTestId("backup-owners-picker") });
    await expect(mappingPanel).toHaveCount(1);
    await mappingPanel.locator("summary").click();

    const mappingRow = mappingPanel
      .locator("div.divide-y > div")
      .filter({ has: page.getByText(service, { exact: true }) });
    await expect(mappingRow).toHaveCount(1);
    await mappingRow.locator("select").first().selectOption(primary.id);

    const picker = mappingRow.getByTestId("backup-owners-picker");
    await picker.click();
    const commandItemFor = (email: string) =>
      page.locator("[cmdk-item]").filter({ hasText: email });
    await expect(commandItemFor(primary.email)).toHaveCount(0);

    const clearBackups = page
      .locator("[cmdk-item]")
      .filter({ hasText: "Clear backup owners" });
    if (await clearBackups.count()) await clearBackups.click();

    await commandItemFor(firstBackup.email).click();
    await commandItemFor(secondBackup.email).click();
    await expect(picker).toContainText("+1");

    await page.keyboard.press("Escape");
    const saved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/service-leader-mapping" &&
        response.request().method() === "PATCH",
    );
    await mappingPanel.getByRole("button", { name: "Save mapping" }).click();
    expect((await saved).ok()).toBeTruthy();

    const reloadedMappings = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/service-leader-mapping" && response.ok(),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await reloadedMappings;

    const reloadedPanel = page
      .locator("details")
      .filter({ has: page.getByTestId("backup-owners-picker") });
    await reloadedPanel.locator("summary").click();
    const reloadedRow = reloadedPanel
      .locator("div.divide-y > div")
      .filter({ has: page.getByText(service, { exact: true }) });
    await expect(reloadedRow.getByTestId("backup-owners-picker")).toContainText("+1");

    const persistedResponse = await context.request.get("/api/service-leader-mapping");
    expect(persistedResponse.ok()).toBeTruthy();
    const persistedMappings = (await persistedResponse.json()) as { items: Mapping[] };
    const persisted = persistedMappings.items.find((mapping) => mapping.service === service);
    expect(persisted?.backup_leader_ids).toHaveLength(2);
    expect(persisted?.backup_leader_ids).toContain(firstBackup.id);
    expect(persisted?.backup_leader_ids).toContain(secondBackup.id);

    await context.close();
  });
});
