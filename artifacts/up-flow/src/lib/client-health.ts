import type { Company } from "@/lib/types";

export type ClientHealthBucket =
  | "risk"
  | "attention"
  | "healthy"
  | "not_enough_data";

export type ClientHealthSort =
  | "risk"
  | "deadline"
  | "value_per_hour"
  | "tracked_time"
  | "name";

export interface ClientHealthSignal {
  key:
    | "overdue_tasks"
    | "no_activity"
    | "missing_contacts"
    | "missing_contract_value"
    | "missing_service_plan"
    | "no_linked_projects";
  label: string;
  active: boolean;
}

export interface RankedClientHealth {
  company: Company;
  score: number;
  bucket: ClientHealthBucket;
  signals: ClientHealthSignal[];
  primaryReason: string;
}

function hasRiskReason(company: Company, match: RegExp) {
  return (company.summary?.risk_reasons ?? []).some((reason) => match.test(reason));
}

export function clientHealthSignals(company: Company): ClientHealthSignal[] {
  const summary = company.summary;
  return [
    {
      key: "overdue_tasks",
      label: "Overdue tasks",
      active: (summary?.overdue_task_count ?? 0) > 0 || hasRiskReason(company, /overdue/i),
    },
    {
      key: "no_activity",
      label: "No activity in 7 days",
      active: hasRiskReason(company, /no activity/i),
    },
    {
      key: "missing_contacts",
      label: "Missing contacts",
      active: (summary?.contact_count ?? 0) === 0 || hasRiskReason(company, /no contacts/i),
    },
    {
      key: "missing_contract_value",
      label: "Missing contract value",
      active: company.contract_value == null || hasRiskReason(company, /contract value/i),
    },
    {
      key: "missing_service_plan",
      label: "Missing service plan",
      active: !company.plan_name && !company.service_type,
    },
    {
      key: "no_linked_projects",
      label: "No linked projects",
      active: (summary?.project_count ?? 0) === 0 || hasRiskReason(company, /linked projects/i),
    },
  ];
}

export function clientHealthBucket(company: Company): ClientHealthBucket {
  const status = company.summary?.health_status;
  if (status === "risk") return "risk";
  if (status === "attention") return "attention";
  if (status === "healthy") return "healthy";
  return "not_enough_data";
}

export function clientHealthScore(company: Company): number {
  const bucket = clientHealthBucket(company);
  const base = {
    risk: 80,
    attention: 45,
    not_enough_data: 35,
    healthy: 0,
  }[bucket];
  const summary = company.summary;
  const activeSignals = clientHealthSignals(company).filter((signal) => signal.active);
  const overdueWeight = Math.min(20, (summary?.overdue_task_count ?? 0) * 5);
  const openTaskWeight = Math.min(10, Math.floor((summary?.open_task_count ?? 0) / 3));
  const noValueWeight = company.contract_value == null ? 8 : 0;
  const noOwnerWeight = company.owner ? 0 : 6;

  return Math.min(100, base + activeSignals.length * 4 + overdueWeight + openTaskWeight + noValueWeight + noOwnerWeight);
}

export function rankClientHealth(companies: Company[], sort: ClientHealthSort = "risk") {
  const ranked = companies.map((company): RankedClientHealth => {
    const signals = clientHealthSignals(company);
    return {
      company,
      score: clientHealthScore(company),
      bucket: clientHealthBucket(company),
      signals,
      primaryReason:
        company.summary?.risk_reasons?.[0] ??
        signals.find((signal) => signal.active)?.label ??
        "No traceable issues",
    };
  });

  return ranked.sort((a, b) => {
    if (sort === "deadline") {
      const aTime = a.company.summary?.next_deadline
        ? new Date(a.company.summary.next_deadline).getTime()
        : Number.POSITIVE_INFINITY;
      const bTime = b.company.summary?.next_deadline
        ? new Date(b.company.summary.next_deadline).getTime()
        : Number.POSITIVE_INFINITY;
      return aTime - bTime || b.score - a.score;
    }
    if (sort === "value_per_hour") {
      return (
        (a.company.summary?.contract_value_per_tracked_hour ?? -1) -
          (b.company.summary?.contract_value_per_tracked_hour ?? -1) ||
        b.score - a.score
      );
    }
    if (sort === "tracked_time") {
      return (b.company.summary?.tracked_seconds ?? 0) - (a.company.summary?.tracked_seconds ?? 0);
    }
    if (sort === "name") {
      return a.company.name.localeCompare(b.company.name);
    }
    return b.score - a.score || a.company.name.localeCompare(b.company.name);
  });
}
