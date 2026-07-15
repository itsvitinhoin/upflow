import { expect, test } from "@playwright/test";
import { apiAs, loginAs, SEEDED, uniq } from "./helpers";

test("Marketing B2B form opens from the replacement task and persists edits", async ({
  baseURL,
  page,
}) => {
  expect(baseURL).toBeTruthy();
  const api = await apiAs(baseURL!, SEEDED.admin.email);
  const memberApi = await apiAs(baseURL!, SEEDED.member.email);

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

    const memberFormResponse = await memberApi.get(
      `/api/onboarding/marketing-b2b-form/${replacementTask.id}`,
    );
    expect(
      memberFormResponse.ok(),
      `member form open failed: ${memberFormResponse.status()} ${await memberFormResponse.text()}`,
    ).toBeTruthy();
    const memberForm = (await memberFormResponse.json()) as { can_edit: boolean };
    expect(memberForm.can_edit).toBe(true);

    const memberEditMarker = uniq("B2B member edit");
    const memberEditResponse = await memberApi.patch(
      `/api/onboarding/marketing-b2b-form/${replacementTask.id}`,
      { data: { field: "brand.notes", value: memberEditMarker } },
    );
    expect(
      memberEditResponse.ok(),
      `member form edit failed: ${memberEditResponse.status()} ${await memberEditResponse.text()}`,
    ).toBeTruthy();

    await loginAs(page.context(), SEEDED.member.email);
    await page.setViewportSize({ width: 1440, height: 900 });
    const formPath = `/api/onboarding/marketing-b2b-form/${replacementTask.id}`;
    await page.route(`**${formPath}`, async (route) => {
      if (route.request().method() === "POST") {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
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
    await expect(page.getByRole("heading", { name: "New client onboarding" })).toHaveCount(0);
    await expect(
      formShell.getByRole("heading", { name: "Marketing B2B Onboarding" }),
    ).toBeVisible();
    await expect(formShell.getByText(company.name, { exact: true })).toBeVisible();

    const progressSidebar = page.getByTestId("b2b-progress-sidebar");
    const pageScroller = page.locator("main.overflow-y-auto").first();
    await expect(progressSidebar).toBeVisible();
    await pageScroller.evaluate((element) => element.scrollTo({ top: 900, behavior: "instant" }));
    await expect.poll(async () => Math.round((await progressSidebar.boundingBox())?.y ?? -1)).toBeLessThanOrEqual(24);
    const stickyTop = Math.round((await progressSidebar.boundingBox())?.y ?? -1);
    await pageScroller.evaluate((element) => element.scrollTo({ top: 1_600, behavior: "instant" }));
    await expect.poll(async () => Math.round((await progressSidebar.boundingBox())?.y ?? -1)).toBe(stickyTop);

    const marker = uniq("B2B saved brand");
    const competitorName = uniq("B2B competitor");
    const brandSection = page.locator("#b2b-section-brand");
    const brandNameInput = brandSection.getByLabel("Nome da marca");
    await expect(brandNameInput).toBeEnabled();
    await brandNameInput.fill(marker);
    await expect(
      brandSection.getByRole("button", { name: "Salvar", exact: true }),
    ).toBeVisible();

    await brandSection.getByRole("button", { name: "Adicionar endereço" }).click();
    await expect(brandSection.getByLabel("Endereço completo")).toHaveCount(2);
    await brandSection.getByLabel("Endereço completo").nth(0).fill("Rua da Loja, 100");
    await brandSection.getByLabel("Endereço completo").nth(1).fill("Rua da Fábrica, 200");

    await brandSection.getByRole("button", { name: "Adicionar concorrente" }).click();
    await brandSection.getByPlaceholder("Ex.: Namine").fill(competitorName);
    await brandSection.getByPlaceholder("@concorrente ou URL").fill("@concorrente");
    await brandSection.getByPlaceholder("https://...").fill("https://concorrente.example");
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
    expect(savedForm.values["brand.notes"]).toBe(memberEditMarker);
    expect(savedForm.values["brand.competitors"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: competitorName,
          instagram: "@concorrente",
          website: "https://concorrente.example",
        }),
      ]),
    );

    const commercialSection = page.locator("#b2b-section-commercial");
    const documentRule = commercialSection.getByLabel("Documento aceito");
    await expect(documentRule).toBeEnabled();
    await documentRule.selectOption("all_cnpjs");
    await expect(
      commercialSection.getByRole("button", { name: "Salvar", exact: true }),
    ).toBeVisible();
    const commercialSave = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname === `/api/onboarding/marketing-b2b-form/${replacementTask.id}` &&
        response.ok(),
    );
    await commercialSection.getByRole("button", { name: "Salvar", exact: true }).click();
    await commercialSave;

    const commercialSavedResponse = await api.get(
      `/api/onboarding/marketing-b2b-form/${replacementTask.id}`,
    );
    const commercialSavedForm = (await commercialSavedResponse.json()) as {
      values: Record<string, unknown>;
      company: { addresses: Array<{ fullAddress: string }> };
    };
    expect(commercialSavedForm.values["commercial.acceptedDocumentRule"]).toBe("all_cnpjs");
    expect(commercialSavedForm.company.addresses.map((address) => address.fullAddress)).toEqual(
      expect.arrayContaining(["Rua da Loja, 100", "Rua da Fábrica, 200"]),
    );

    const formReloaded = waitForForm();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    await formReloaded;
    await expect(page.locator(".marketing-b2b-form-shell")).toBeVisible();
    await expect(page.getByLabel("Nome da marca")).toHaveValue(marker);
  } finally {
    await memberApi.dispose();
    await api.dispose();
  }
});

test("Creating a client with Vesti and UP Zero creates the complete service workflows", async ({
  baseURL,
}) => {
  expect(baseURL).toBeTruthy();
  const api = await apiAs(baseURL!, SEEDED.admin.email);

  try {
    const companyResponse = await api.post("/api/companies", {
      data: {
        name: uniq("Vesti and UP Zero workflow company"),
        included_services: ["Vesti", "UP Zero"],
        start_onboarding: true,
      },
    });
    expect(
      companyResponse.ok(),
      `company creation failed: ${companyResponse.status()} ${await companyResponse.text()}`,
    ).toBeTruthy();

    const company = (await companyResponse.json()) as {
      onboarding_id: string;
      created_onboarding_tasks: Array<{ id: string; title: string; project_id: string }>;
    };
    expect(company.onboarding_id).toBeTruthy();

    const createdTitles = company.created_onboarding_tasks.map((task) => task.title);
    expect(createdTitles.filter((title) => title.startsWith("Vesti: "))).toHaveLength(10);
    expect(createdTitles.filter((title) => title.startsWith("UP Zero: "))).toHaveLength(9);
    expect(createdTitles).toEqual(
      expect.arrayContaining([
        "Vesti: Criar grupo de WhatsApp e capa",
        "Vesti: Agendar apresentação e dia do onboarding",
        "Vesti: Realizar onboarding",
        "Vesti: Criar e validar o UP Dash",
        "UP Zero: Criar grupo de WhatsApp e capa",
        "UP Zero: Realizar configuração técnica",
        "UP Zero: Preparar briefing de criativos",
        "UP Zero: Treinar o cliente no uso do UP Dash",
      ]),
    );
    const b2bFormTask = company.created_onboarding_tasks.find(
      (task) => task.title === "Marketing B2B onboarding form",
    );
    expect(b2bFormTask?.project_id).toBeTruthy();
    expect(
      company.created_onboarding_tasks
        .filter((task) => task.title.startsWith("Vesti: ") || task.title.startsWith("UP Zero: "))
        .every((task) => task.project_id === b2bFormTask?.project_id),
    ).toBe(true);
    const b2bProjectResponse = await api.get(`/api/projects/${b2bFormTask?.project_id}`);
    expect(b2bProjectResponse.ok()).toBeTruthy();
    expect(((await b2bProjectResponse.json()) as { onboarding_enabled: boolean }).onboarding_enabled).toBe(true);

    const onboardingResponse = await api.get(`/api/onboarding/${company.onboarding_id}`);
    expect(
      onboardingResponse.ok(),
      `onboarding read failed: ${onboardingResponse.status()} ${await onboardingResponse.text()}`,
    ).toBeTruthy();
    const onboarding = (await onboardingResponse.json()) as {
      checklist_items: Array<{
        id: string;
        title: string;
        department: string;
        task: { id: string } | null;
      }>;
      meetings: Array<{ service: string; checklist_item_id: string }>;
    };
    const vestiItems = onboarding.checklist_items.filter((item) => item.title.startsWith("Vesti: "));
    const upZeroItems = onboarding.checklist_items.filter((item) => item.title.startsWith("UP Zero: "));
    expect(vestiItems).toHaveLength(10);
    expect(upZeroItems).toHaveLength(9);
    expect([...vestiItems, ...upZeroItems].every((item) => Boolean(item.task?.id))).toBe(true);

    const vestiMeeting = onboarding.meetings.find((meeting) => meeting.service === "Vesti");
    const upZeroMeeting = onboarding.meetings.find((meeting) => meeting.service === "UP Zero");
    expect(vestiMeeting?.checklist_item_id).toBeTruthy();
    expect(upZeroMeeting?.checklist_item_id).toBeTruthy();
    expect(vestiItems.some((item) => item.id === vestiMeeting?.checklist_item_id)).toBe(true);
    expect(upZeroItems.some((item) => item.id === upZeroMeeting?.checklist_item_id)).toBe(true);

    const laterCompanyResponse = await api.post("/api/companies", {
      data: {
        name: uniq("Later Vesti workflow company"),
        included_services: ["Meta Ads"],
        start_onboarding: true,
      },
    });
    expect(laterCompanyResponse.ok()).toBeTruthy();
    const laterCompany = (await laterCompanyResponse.json()) as {
      id: string;
      onboarding_id: string;
      created_onboarding_tasks: Array<{ id: string; title: string; project_id: string }>;
    };
    const laterB2BProjectId = laterCompany.created_onboarding_tasks.find(
      (task) => task.title === "Marketing B2B onboarding form",
    )?.project_id;
    expect(laterB2BProjectId).toBeTruthy();

    const addVestiResponse = await api.patch(`/api/companies/${laterCompany.id}`, {
      data: { included_services: ["Meta Ads", "Vesti"] },
    });
    expect(
      addVestiResponse.ok(),
      `adding Vesti failed: ${addVestiResponse.status()} ${await addVestiResponse.text()}`,
    ).toBeTruthy();
    const syncedCompany = (await addVestiResponse.json()) as {
      onboarding_id: string;
      synced_onboarding_tasks: Array<{ title: string; project_id: string }>;
      moved_onboarding_tasks: number;
    };
    expect(syncedCompany.onboarding_id).toBe(laterCompany.onboarding_id);
    expect(syncedCompany.synced_onboarding_tasks).toHaveLength(10);
    expect(
      syncedCompany.synced_onboarding_tasks.every((task) => task.project_id === laterB2BProjectId),
    ).toBe(true);

    const syncedOnboardingResponse = await api.get(`/api/onboarding/${laterCompany.onboarding_id}`);
    expect(syncedOnboardingResponse.ok()).toBeTruthy();
    const syncedOnboarding = (await syncedOnboardingResponse.json()) as {
      checklist_items: Array<{ title: string; task: { project_id: string } | null }>;
    };
    const syncedVestiItems = syncedOnboarding.checklist_items.filter((item) => item.title.startsWith("Vesti: "));
    expect(syncedVestiItems).toHaveLength(10);
    expect(syncedVestiItems.every((item) => item.task?.project_id === laterB2BProjectId)).toBe(true);

    const repeatSyncResponse = await api.patch(`/api/companies/${laterCompany.id}`, {
      data: { included_services: ["Meta Ads", "Vesti"] },
    });
    expect(repeatSyncResponse.ok()).toBeTruthy();
    const repeatedSync = (await repeatSyncResponse.json()) as {
      synced_onboarding_tasks: unknown[];
      moved_onboarding_tasks: number;
    };
    expect(repeatedSync.synced_onboarding_tasks).toHaveLength(0);
    expect(repeatedSync.moved_onboarding_tasks).toBe(0);
  } finally {
    await api.dispose();
  }
});
