import assert from "node:assert/strict";
import test from "node:test";
import { activityEntityLabel, activityEventLabel } from "../../src/lib/activity-labels";
import { translations } from "../../src/lib/i18n/translations";
import { onboardingTitleLabel } from "../../src/lib/onboarding-labels";

function portuguese(key: string, vars?: Record<string, string | number>) {
  const source = translations["pt-BR"][key] ?? translations.en[key] ?? key;
  return source.replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`));
}

test("activity events and entity types use localized labels instead of raw identifiers", () => {
  assert.equal(activityEventLabel("folder_deleted", portuguese), "Pasta excluída");
  assert.equal(activityEventLabel("marketing_b2b_released", portuguese), "Marketing B2B liberado");
  assert.equal(activityEntityLabel("client_onboarding", portuguese), "Onboarding do cliente");
});

test("legacy onboarding titles render in Portuguese while custom titles remain intact", () => {
  assert.equal(
    onboardingTitleLabel("Company registration completed", portuguese),
    "Cadastro da empresa concluído",
  );
  assert.equal(
    onboardingTitleLabel("Meta Ads onboarding meeting scheduled", portuguese),
    "Meta Ads: reunião de onboarding agendada",
  );
  assert.equal(onboardingTitleLabel("Plano personalizado do cliente", portuguese), "Plano personalizado do cliente");
});

test("onboarding sequence statuses have Portuguese labels", () => {
  assert.equal(portuguese("onboardingWorkflow.status.marketing_b2b_ready"), "Marketing B2B pronto");
  assert.equal(portuguese("onboardingWorkflow.status.technical_support_pending"), "Suporte Técnico pendente");
});
