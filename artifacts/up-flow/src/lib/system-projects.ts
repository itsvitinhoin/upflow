import { isCreativeDesignDepartmentName } from "@/lib/company-creation-access";

function normalizeSystemProjectName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isDesignQueueName(value: string | null | undefined) {
  return normalizeSystemProjectName(value) === "design queue";
}

export function isProtectedDesignQueue(input: {
  projectName: string | null | undefined;
  spaceName: string | null | undefined;
}) {
  return (
    isDesignQueueName(input.projectName) &&
    isCreativeDesignDepartmentName(input.spaceName)
  );
}
