import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import path from "node:path";
import { apiAs, loginAs, SEEDED } from "../tests/helpers";

type Theme = "light" | "dark";

type CreatedOnboardingTask = {
  id: string;
  title: string;
  project_id: string;
};

type VisualCompany = {
  id: string;
  created_onboarding_tasks: CreatedOnboardingTask[];
};

type VisualFixture = {
  companyId: string;
  financeUrl: string;
  marketingB2CUrl: string;
};

const screenshotStyle = path.join(__dirname, "theme-screenshot.css");
const themes: Theme[] = ["light", "dark"];
let fixture: VisualFixture;
let fixtureApi: APIRequestContext;

function taskUrl(company: VisualCompany, title: string) {
  const task = company.created_onboarding_tasks.find((item) => item.title === title);
  expect(task, `Expected onboarding task \"${title}\"`).toBeTruthy();
  return `/projects/${task!.project_id}?view=form&task=${task!.id}`;
}

async function waitForVisualReadiness(page: Page, theme: Theme) {
  await expect(page.locator("html")).toHaveAttribute("data-visual-theme-ready", "true");
  await expect(page.locator("html")).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function capture(page: Page, theme: Theme, name: string) {
  await waitForVisualReadiness(page, theme);
  await expect(page).toHaveScreenshot(name, {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    maxDiffPixelRatio: 0.005,
    scale: "css",
    stylePath: screenshotStyle,
  });
}

test.describe("light and dark theme visual regression", () => {
  test.beforeAll(async ({ baseURL }) => {
    expect(baseURL).toBeTruthy();
    fixtureApi = await apiAs(baseURL!, SEEDED.admin.email);
    const response = await fixtureApi.post("/api/companies", {
      data: {
        name: "Theme Visual Client",
        included_services: ["Social Media"],
        contract_start_date: "2026-01-15",
        start_onboarding: true,
      },
    });
    expect(
      response.ok(),
      `Visual fixture creation failed: ${response.status()} ${await response.text()}`,
    ).toBeTruthy();
    const company = (await response.json()) as VisualCompany;
    const directoryProject = await fixtureApi.post("/api/projects", {
      data: {
        name: "Theme Visual Campaign",
        company_id: company.id,
      },
    });
    expect(
      directoryProject.ok(),
      `Visual directory fixture failed: ${directoryProject.status()} ${await directoryProject.text()}`,
    ).toBeTruthy();
    fixture = {
      companyId: company.id,
      financeUrl: taskUrl(company, "Onboarding: complete finance registration"),
      marketingB2CUrl: taskUrl(company, "Marketing B2C onboarding form"),
    };
  });

  test.afterAll(async () => {
    await fixtureApi?.dispose();
  });

  for (const theme of themes) {
    test.describe(theme, () => {
      test.use({ colorScheme: theme });

      test.beforeEach(async ({ context }) => {
        await context.addInitScript((selectedTheme: Theme) => {
          localStorage.setItem("upflow.theme", selectedTheme);
          localStorage.setItem("upflow.language", "en");
          localStorage.setItem("upflow.sidebar.spacesOpen", "1");
          document.documentElement.setAttribute("data-visual-theme-ready", "true");
        }, theme);
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
        await loginAs(context, SEEDED.admin.email);
      });

      test("project board and filter popover", async ({ page }) => {
        await page.goto("/projects/project-website-redesign");
        await expect(page.getByRole("heading", { name: "Website Redesign", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Board", exact: true }).click();
        await page.getByRole("button", { name: "Filter", exact: true }).click();
        await expect(page.getByText("Priority", { exact: true })).toBeVisible();
        await capture(page, theme, `${theme}-project-board-filter.png`);
      });

      test("project directory and expanded client group", async ({ page }) => {
        await page.goto("/projects?q=Theme%20Visual%20Client");
        await expect(page.getByRole("heading", { name: "Find work without the clutter" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Theme Visual Campaign" })).toBeVisible();
        await capture(page, theme, `${theme}-project-directory.png`);
      });

      test("project directory mobile layout", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/projects?q=Theme%20Visual%20Client");
        await expect(page.getByRole("heading", { name: "Find work without the clutter" })).toBeVisible();
        await capture(page, theme, `${theme}-project-directory-mobile.png`);
      });

      test("sidebar project search", async ({ page }) => {
        await page.goto("/projects?tab=internal");
        const sidebarSearch = page.getByPlaceholder("Find spaces and projects...");
        await sidebarSearch.fill("Website Redesign");
        await expect(page.getByTitle(/Website Redesign/)).toBeVisible();
        await capture(page, theme, `${theme}-sidebar-project-search.png`);
      });

      test("new project dialog", async ({ page }) => {
        await page.goto("/projects/project-website-redesign");
        await expect(page.getByRole("heading", { name: "Website Redesign", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "New Project", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "New Project" })).toBeVisible();
        await capture(page, theme, `${theme}-new-project-dialog.png`);
      });

      test("finance onboarding form", async ({ page }) => {
        await page.goto(fixture.financeUrl);
        await expect(page.getByRole("heading", { name: "Finance Onboarding", exact: true })).toBeVisible();
        await expect(page.getByLabel("Brand name", { exact: true })).toBeVisible();
        await capture(page, theme, `${theme}-finance-onboarding.png`);
      });

      test("marketing B2C onboarding form", async ({ page }) => {
        await page.goto(fixture.marketingB2CUrl);
        await expect(page.getByLabel("Brand name", { exact: true })).toBeVisible();
        await capture(page, theme, `${theme}-marketing-b2c-onboarding.png`);
      });

      test("client onboarding panel", async ({ page }) => {
        await page.goto(`/clients/${fixture.companyId}`);
        await expect(page.getByRole("heading", { name: "Theme Visual Client", exact: true })).toBeVisible();
        const onboarding = page.getByRole("heading", { name: "New client onboarding", exact: true });
        await expect(onboarding).toBeVisible();
        await onboarding.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollBy(0, -96));
        await capture(page, theme, `${theme}-client-onboarding.png`);
      });
    });
  }
});
