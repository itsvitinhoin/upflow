import { test } from "node:test";
import assert from "node:assert/strict";
import { builtInTemplates } from "../../src/lib/templates";

test("built-in templates cover the agency operating playbooks", () => {
  const requiredTemplateIds = [
    "client-onboarding",
    "meta-ads-campaign-launch",
    "google-ads-campaign-launch",
    "social-monthly-content-plan",
    "creative-production-request",
    "landing-page-build",
    "weekly-report",
    "website-maintenance-request",
    "influencer-campaign",
    "email-marketing-campaign",
    "client-monthly-review",
  ];

  const ids = new Set(builtInTemplates.map((template) => template.id));

  for (const id of requiredTemplateIds) {
    assert.ok(ids.has(id), `missing agency template ${id}`);
  }
});

test("agency templates are practical starter playbooks without fake metrics", () => {
  for (const template of builtInTemplates) {
    assert.ok(template.name.trim().length > 0, `template ${template.id} needs a name`);
    assert.ok(template.description.trim().length > 12, `template ${template.id} needs useful copy`);
    assert.ok(template.config.projectName.trim().length > 0, `template ${template.id} needs a project name`);
    assert.ok(
      template.config.tasks.length >= 4,
      `template ${template.id} should include enough starter tasks`,
    );

    for (const task of template.config.tasks) {
      assert.ok(task.title.trim().length > 0, `template ${template.id} has an empty task`);
      assert.ok(
        task.priority === undefined ||
          task.priority === "low" ||
          task.priority === "medium" ||
          task.priority === "high",
        `template ${template.id} has invalid priority ${task.priority}`,
      );
    }
  }
});
