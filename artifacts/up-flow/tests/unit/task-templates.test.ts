import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskBrief,
  getLocalizedTaskTemplate,
  parseTaskBrief,
  TASK_TEMPLATES,
} from "../../src/lib/task-templates";

test("task templates cover agency departments and marketing modes", () => {
  const ids = new Set(TASK_TEMPLATES.map((template) => template.id));

  assert.ok(ids.has("creative"));
  assert.ok(ids.has("b2b_marketing"));
  assert.ok(ids.has("b2c_marketing"));
  assert.ok(ids.has("commercial"));
  assert.ok(ids.has("finance"));
  assert.ok(ids.has("production"));
  assert.ok(ids.has("technical_support"));
  assert.ok(ids.has("admin"));
});

test("task template briefs are saved as parseable structured descriptions", () => {
  const brief = buildTaskBrief({
    templateId: "commercial",
    values: {
      lead_company: "Acme",
      deal_stage: "Proposal",
      expected_value: "$12k",
    },
    notes: "Follow up after the client call.",
  });

  const parsed = parseTaskBrief(brief);
  assert.equal(parsed?.type, "Commercial");
  assert.deepEqual(
    parsed?.details.slice(0, 3),
    [
      { label: "Lead / company", value: "Acme" },
      { label: "Deal stage", value: "Proposal" },
      { label: "Expected value", value: "$12k" },
    ],
  );
  assert.ok(brief.includes("Follow up after the client call."));
  assert.ok((parsed?.checklist.length ?? 0) > 0);
});

test("Portuguese task templates localize fields and structured task briefs", () => {
  const template = getLocalizedTaskTemplate("general", "pt-BR");
  assert.equal(template.label, "Tarefa geral");
  assert.deepEqual(template.fields[0], {
    key: "objective",
    label: "Objetivo",
    placeholder: "O que precisa ser concluído?",
    kind: "textarea",
  });

  const brief = buildTaskBrief({
    templateId: "general",
    values: { objective: "Preparar a proposta" },
    locale: "pt-BR",
  });
  const parsed = parseTaskBrief(brief, "pt-BR");

  assert.match(brief, /^Tipo: Tarefa geral/m);
  assert.deepEqual(parsed?.details, [{ label: "Objetivo", value: "Preparar a proposta" }]);
  assert.ok((parsed?.checklist ?? []).includes("Confirmar responsável"));
});
