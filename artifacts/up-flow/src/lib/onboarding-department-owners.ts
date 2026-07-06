export const ONBOARDING_DEPARTMENT_OWNERS = [
  {
    key: "commercial",
    label: "Comercial",
    route: "commercial",
    aliases: ["commercial", "comercial"],
  },
  {
    key: "finance",
    label: "Finance",
    route: "finance",
    aliases: ["finance", "financeiro", "financial"],
  },
  {
    key: "marketing_b2b",
    label: "Marketing B2B",
    route: "marketing_b2b",
    aliases: ["marketing b2b", "b2b"],
  },
  {
    key: "marketing_b2c",
    label: "Marketing B2C",
    route: "marketing_b2c",
    aliases: ["marketing b2c", "b2c", "varejo", "ecommerce"],
  },
  {
    key: "creative_design",
    label: "Creative & Design",
    route: "creative_design",
    aliases: ["creative & design", "creative and design", "creative design", "criativo", "design"],
  },
  {
    key: "production",
    label: "Production",
    route: "creative_design",
    aliases: ["production", "producao", "producao"],
  },
  {
    key: "technical_support",
    label: "Technical Support",
    route: "support",
    aliases: ["technical support", "support", "suporte", "suporte tecnico", "suporte tecnico"],
  },
] as const;

export type OnboardingDepartmentOwner = (typeof ONBOARDING_DEPARTMENT_OWNERS)[number];
export type OnboardingDepartmentOwnerKey = OnboardingDepartmentOwner["key"];

const ownerByKey = new Map(ONBOARDING_DEPARTMENT_OWNERS.map((owner) => [owner.key, owner]));

function normalizeOwnerLookup(value: string | null | undefined) {
  return value
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function onboardingDepartmentOwnerLabels() {
  return ONBOARDING_DEPARTMENT_OWNERS.map((owner) => owner.label);
}

export function onboardingDepartmentOwnerForKey(key: OnboardingDepartmentOwnerKey | null | undefined) {
  return key ? ownerByKey.get(key) ?? null : null;
}

export function ownerKeyForDepartmentLabel(value: string | null | undefined) {
  const normalized = normalizeOwnerLookup(value);
  if (!normalized) return null;
  for (const owner of ONBOARDING_DEPARTMENT_OWNERS) {
    const candidates = [owner.label, owner.key, owner.route, ...owner.aliases].map(normalizeOwnerLookup);
    if (candidates.includes(normalized)) return owner.key;
  }
  return null;
}

export function ownerKeyForTaskRoute(route: string | null | undefined): OnboardingDepartmentOwnerKey {
  switch (route) {
    case "finance":
      return "finance";
    case "support":
      return "technical_support";
    case "marketing_b2b":
      return "marketing_b2b";
    case "marketing_b2c":
      return "marketing_b2c";
    case "creative_design":
      return "creative_design";
    case "commercial":
    default:
      return "commercial";
  }
}

export function ownerLabelForTaskRoute(route: string | null | undefined) {
  return onboardingDepartmentOwnerForKey(ownerKeyForTaskRoute(route))?.label ?? "Comercial";
}

