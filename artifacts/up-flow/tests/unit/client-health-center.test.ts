import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import {
  clientHealthSignals,
  rankClientHealth,
} from "../../src/lib/client-health";
import type { Company } from "../../src/lib/types";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function company(overrides: Partial<Company>): Company {
  return {
    id: overrides.id ?? overrides.name ?? "company",
    workspace_id: "workspace",
    name: overrides.name ?? "Client",
    description: null,
    website: null,
    status: "active",
    commercial_status: null,
    contract_value: overrides.contract_value ?? null,
    contract_currency: null,
    contract_period: null,
    commission_value: null,
    commission_type: null,
    owner_id: null,
    owner: overrides.owner ?? null,
    service_type: overrides.service_type ?? null,
    plan_name: overrides.plan_name ?? null,
    billing_cycle: null,
    included_services: [],
    plan_notes: null,
    notes: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    summary: overrides.summary,
  } as Company;
}

test("client health ranks risky clients ahead of healthy clients", () => {
  const risky = company({
    name: "Risky",
    contract_value: null,
    plan_name: null,
    service_type: null,
    summary: {
      health_status: "risk",
      overdue_task_count: 3,
      open_task_count: 9,
      contact_count: 0,
      project_count: 0,
      risk_reasons: ["No activity in 7 days", "No contacts"],
      tracked_seconds: 0,
      next_deadline: "2026-06-28T00:00:00.000Z",
      contract_value_per_tracked_hour: null,
    },
  });
  const healthy = company({
    name: "Healthy",
    contract_value: 5000,
    plan_name: "Growth",
    service_type: "Social",
    owner: { id: "owner", name: "Alex", email: "alex@example.com" },
    summary: {
      health_status: "healthy",
      overdue_task_count: 0,
      open_task_count: 1,
      contact_count: 2,
      project_count: 2,
      risk_reasons: [],
      tracked_seconds: 7200,
      next_deadline: "2026-07-10T00:00:00.000Z",
      contract_value_per_tracked_hour: 2500,
    },
  });

  const ranked = rankClientHealth([healthy, risky]);
  assert.equal(ranked[0].company.name, "Risky");
  assert.equal(ranked[0].bucket, "risk");
  assert.ok(ranked[0].score > ranked[1].score);
});

test("client health exposes every leadership signal", () => {
  const signals = clientHealthSignals(company({
    contract_value: null,
    plan_name: null,
    service_type: null,
    summary: {
      health_status: "risk",
      overdue_task_count: 1,
      open_task_count: 1,
      contact_count: 0,
      project_count: 0,
      risk_reasons: ["No activity in 7 days"],
      tracked_seconds: 0,
      next_deadline: null,
      contract_value_per_tracked_hour: null,
    },
  })).filter((signal) => signal.active);

  assert.deepEqual(
    signals.map((signal) => signal.key).sort(),
    [
      "missing_contacts",
      "missing_contract_value",
      "missing_service_plan",
      "no_activity",
      "no_linked_projects",
      "overdue_tasks",
    ],
  );
});

test("client health center is linked from clients and supports scale controls", () => {
  const healthPage = read("src/app/(dashboard)/clients/health/page.tsx");
  const clientsPage = read("src/app/(dashboard)/clients/page.tsx");

  assert.match(clientsPage, /href="\/clients\/health"/);
  assert.match(healthPage, /\/api\/companies\?limit=100/);
  assert.match(healthPage, /needs_attention/);
  assert.match(healthPage, /ClientHealthTable/);
  assert.match(healthPage, /t\("clientHealth\.attentionQueue"\)/);
  assert.match(healthPage, /value_per_hour/);
});
