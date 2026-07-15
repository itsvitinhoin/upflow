export type OnboardingTaskRoute =
  | "commercial"
  | "finance"
  | "support"
  | "marketing_b2b"
  | "marketing_b2c"
  | "creative_design"
  | "general_admin";

export function normalizeOnboardingRouteValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function hasWord(value: string, word: string) {
  return new RegExp(`(^|\\s)${word}(\\s|$)`).test(value);
}

export function routeForResponsibleDepartment(
  value: string | null | undefined,
): OnboardingTaskRoute | null {
  const key = normalizeOnboardingRouteValue(value ?? "");
  if (!key) return null;
  if (key.includes("marketing b2c") || key === "b2c" || key.includes("consumer marketing")) {
    return "marketing_b2c";
  }
  if (key.includes("marketing b2b") || key === "b2b") return "marketing_b2b";
  if (key.includes("creative") || key.includes("design")) return "creative_design";
  if (key.includes("finance") || key.includes("financeiro") || key.includes("financial")) return "finance";
  if (key.includes("support") || key.includes("suporte")) return "support";
  if (key.includes("commercial") || key.includes("comercial") || key.includes("sales")) return "commercial";
  if (key.includes("general admin") || key === "admin") return "general_admin";
  return null;
}

export function routeForService(service: string | null | undefined): OnboardingTaskRoute {
  const key = normalizeOnboardingRouteValue(service ?? "");
  if (!key) return "general_admin";

  const directDepartmentRoute = routeForResponsibleDepartment(key);
  if (directDepartmentRoute) return directDepartmentRoute;

  if (
    key.includes("nuvemshop") ||
    key.includes("google shopping") ||
    key.includes("influencer") ||
    key.includes("ugc") ||
    key.includes("content calendar") ||
    key.includes("calendario de conteudo") ||
    key.includes("promotions") ||
    key.includes("promocoes") ||
    key.includes("campaigns") ||
    key.includes("campanhas") ||
    key === "ads" ||
    key.includes("trafego") ||
    key.includes("midia")
  ) {
    return "marketing_b2c";
  }
  if (
    hasWord(key, "b2b") ||
    key.includes("paid media") ||
    key.includes("media buying") ||
    key.includes("trafego pago") ||
    key.includes("meta ads") ||
    key.includes("google ads") ||
    key.includes("e commerce") ||
    key.includes("ecommerce") ||
    key.includes("vesti") ||
    key.includes("up zero") ||
    key.includes("up motion") ||
    key.includes("social") ||
    key.includes("seo") ||
    key.includes("tracking") ||
    key.includes("analytics") ||
    key.includes("email") ||
    key.includes("monthly report") ||
    key.includes("content")
  ) {
    return "marketing_b2b";
  }
  if (key.includes("creative") || key.includes("video") || key.includes("website") || key.includes("web design") || key.includes("landing page")) {
    return "creative_design";
  }
  if (key.includes("support") || key.includes("suporte")) return "support";
  if (key.includes("finance") || key.includes("financeiro") || key.includes("financial") || key.includes("billing") || key.includes("faturamento") || key.includes("contract") || key.includes("contrato")) {
    return "finance";
  }
  if (key.includes("commercial") || key.includes("comercial") || key.includes("sales") || key.includes("vendas")) {
    return "commercial";
  }

  return "general_admin";
}

export function routeForOnboardingChecklistItem(input: {
  department: string | null | undefined;
  service?: string | null;
  title?: string | null;
  taskTitle?: string | null;
}): OnboardingTaskRoute {
  const departmentRoute = routeForResponsibleDepartment(input.department);
  if (departmentRoute) return departmentRoute;

  const department = normalizeOnboardingRouteValue(input.department ?? "");
  if (department.includes("contract") || department.includes("contrato")) return "finance";

  const combined = [input.department, input.service, input.title, input.taskTitle]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");

  return routeForService(combined);
}
