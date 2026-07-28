import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("clients can be classified and filtered by wholesale or retail sales channel", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260728181414_add_company_sales_channel/migration.sql");
  const companiesRoute = read("src/app/api/companies/route.ts");
  const companyRoute = read("src/app/api/companies/[id]/route.ts");
  const clientsPage = read("src/app/(dashboard)/clients/page.tsx");
  const clientDetail = read("src/app/(dashboard)/clients/[id]/page.tsx");
  const createDialog = read("src/components/dashboard/create-company-dialog.tsx");
  const onboardingDialog = read("src/components/onboarding/start-client-onboarding-dialog.tsx");
  const onboardingRoute = read("src/app/api/onboarding/client-wizard/route.ts");
  const onboarding = read("src/lib/onboarding.ts");
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(schema, /enum ClientSalesChannel \{[\s\S]*WHOLESALE[\s\S]*RETAIL[\s\S]*BOTH/);
  assert.match(schema, /sales_channel\s+ClientSalesChannel\?/);
  assert.match(schema, /@@index\(\[workspace_id, sales_channel, created_at\(sort: Desc\), id\]\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "sales_channel" "ClientSalesChannel"/);
  assert.doesNotMatch(migration, /UPDATE\s+"Company"/);

  assert.match(companiesRoute, /CompanySalesChannelFilterSchema/);
  assert.match(companiesRoute, /case "wholesale":[\s\S]*sales_channel: \{ in: \["WHOLESALE", "BOTH"\] \}/);
  assert.match(companiesRoute, /case "retail":[\s\S]*sales_channel: \{ in: \["RETAIL", "BOTH"\] \}/);
  assert.match(companiesRoute, /case "both":[\s\S]*sales_channel: "BOTH"/);
  assert.match(companiesRoute, /case "unclassified":[\s\S]*sales_channel: null/);
  assert.match(companiesRoute, /sales_channel: parsed\.data\.sales_channel \?\? null/);
  assert.match(companyRoute, /sales_channel: ClientSalesChannelSchema\.nullable\(\)\.optional\(\)/);

  assert.match(clientsPage, /type ClientSalesChannelFilter/);
  assert.match(clientsPage, /params\.set\("sales_channel", salesChannel\)/);
  assert.match(clientsPage, /clients\.salesChannel\.wholesale/);
  assert.match(clientDetail, /formatSalesChannel/);
  assert.match(createDialog, /sales_channel: salesChannel \|\| null/);
  assert.match(onboardingDialog, /sales_channel: salesChannel \|\| null/);
  assert.match(onboardingRoute, /salesChannel: parsed\.data\.sales_channel/);
  assert.match(onboarding, /sales_channel: input\.salesChannel \?\? null/);
  assert.match(translations, /"clients\.salesChannel\.wholesale": "Atacado"/);
  assert.match(translations, /"clients\.salesChannel\.retail": "Varejo"/);
});
