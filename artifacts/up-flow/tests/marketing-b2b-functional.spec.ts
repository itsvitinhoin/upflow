import { expect, test } from "@playwright/test";
import { apiAs, loginAs, SEEDED, uniq } from "./helpers";

test("Marketing B2B form opens from the replacement task and persists edits", async ({
  baseURL,
  page,
}) => {
  expect(baseURL).toBeTruthy();
  const api = await apiAs(baseURL!, SEEDED.admin.email);

  try {
    const companyResponse = await api.post("/api/companies", {
      data: {
        name: uniq("B2B functional company"),
        start_onboarding: false,
      },
    });
    expect(
      companyResponse.ok(),
      `company creation failed: ${companyResponse.status()} ${await companyResponse.text()}`,
    ).toBeTruthy();
    const company = (await companyResponse.json()) as { id: string; name: string };

    const createProject = async (name: string) => {
      const response = await api.post("/api/projects", {
        data: { name, company_id: company.id },
      });
      expect(
        response.ok(),
        `project creation failed: ${response.status()} ${await response.text()}`,
      ).toBeTruthy();
      return (await response.json()) as { id: string; name: string };
    };

    const createTask = async (projectId: string) => {
      const response = await api.post("/api/tasks", {
        data: {
          title: "Marketing B2B onboarding form",
          description:
            "Marketing B2B queue action: complete the client onboarding form. Fields are optional and autosaved.",
          project_id: projectId,
        },
      });
      expect(
        response.ok(),
        `task creation failed: ${response.status()} ${await response.text()}`,
      ).toBeTruthy();
      return (await response.json()) as { id: string };
    };

    const firstProject = await createProject(uniq("B2B functional project A"));
    const firstTask = await createTask(firstProject.id);
    const firstFormResponse = await api.get(
      `/api/onboarding/marketing-b2b-form/${firstTask.id}`,
    );
    expect(
      firstFormResponse.ok(),
      `first form open failed: ${firstFormResponse.status()} ${await firstFormResponse.text()}`,
    ).toBeTruthy();
    const firstForm = (await firstFormResponse.json()) as {
      id: string;
      onboarding: { id: string };
      task: { id: string; project: { id: string } };
    };
    expect(firstForm.task.id).toBe(firstTask.id);
    expect(firstForm.task.project.id).toBe(firstProject.id);

    // Reproduce the production failure mode: the same company receives a
    // newer Marketing B2B form task while an onboarding form already exists.
    const replacementProject = await createProject(uniq("B2B functional project B"));
    const replacementTask = await createTask(replacementProject.id);
    const reboundFormResponse = await api.get(
      `/api/onboarding/marketing-b2b-form/${replacementTask.id}`,
    );
    expect(
      reboundFormResponse.ok(),
      `replacement form open failed: ${reboundFormResponse.status()} ${await reboundFormResponse.text()}`,
    ).toBeTruthy();
    const reboundForm = (await reboundFormResponse.json()) as {
      id: string;
      can_edit: boolean;
      onboarding: { id: string };
      task: { id: string; project: { id: string } };
    };
    expect(reboundForm.id).toBe(firstForm.id);
    expect(reboundForm.onboarding.id).toBe(firstForm.onboarding.id);
    expect(reboundForm.task.id).toBe(replacementTask.id);
    expect(reboundForm.task.project.id).toBe(replacementProject.id);
    expect(reboundForm.can_edit).toBe(true);

    await loginAs(page.context(), SEEDED.admin.email);
    const formPath = `/api/onboarding/marketing-b2b-form/${replacementTask.id}`;
    const waitForForm = () =>
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === formPath && response.ok(),
        { timeout: 30_000 },
      );
    const formLoaded = waitForForm();
    await page.goto(
      `/projects/${replacementProject.id}?view=form&task=${replacementTask.id}`,
      { waitUntil: "domcontentloaded", timeout: 30_000 },
    );
    await formLoaded;

    const formShell = page.locator(".marketing-b2b-form-shell");
    await expect(formShell).toBeVisible();
    await expect(
      formShell.getByRole("heading", { name: "Marketing B2B Onboarding" }),
    ).toBeVisible();
    await expect(formShell.getByText(company.name, { exact: true })).toBeVisible();

    const marker = uniq("B2B saved brand");
    const brandSection = page.locator("#b2b-section-brand");
    await brandSection.getByRole("button", { name: /Editar se/ }).click();
    await brandSection.getByLabel("Nome da marca").fill(marker);
    await brandSection.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      brandSection.getByRole("button", { name: /Editar se/ }),
    ).toBeVisible();

    const savedResponse = await api.get(
      `/api/onboarding/marketing-b2b-form/${replacementTask.id}`,
    );
    expect(
      savedResponse.ok(),
      `saved form read failed: ${savedResponse.status()} ${await savedResponse.text()}`,
    ).toBeTruthy();
    const savedForm = (await savedResponse.json()) as {
      status: string;
      values: Record<string, unknown>;
    };
    expect(savedForm.status).toBe("in_progress");
    expect(savedForm.values["brand.name"]).toBe(marker);

    const formReloaded = waitForForm();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    await formReloaded;
    await expect(page.locator(".marketing-b2b-form-shell")).toBeVisible();
    await expect(page.getByLabel("Nome da marca")).toHaveValue(marker);
  } finally {
    await api.dispose();
  }
});
