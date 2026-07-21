export type CreativeBriefingLocale = "en" | "pt-BR";

export type CreativeBriefingPriority = "low" | "medium" | "high";
export type CreativeBriefingDimensionUnit = "px" | "cm" | "mm";

export interface CreativeBriefingMember {
  id: string;
  name: string;
  email: string;
  department_name?: string | null;
}

function normalizeDepartmentName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isCreativeDesignDepartmentName(
  value: string | null | undefined,
) {
  const departmentName = normalizeDepartmentName(value);
  return (
    departmentName === "creative & design" ||
    departmentName === "criativos & design" ||
    departmentName === "criacao e design"
  );
}

export function filterCreativeBriefingDesigners<
  T extends CreativeBriefingMember,
>(members: T[]): T[] {
  return members.filter((member) =>
    isCreativeDesignDepartmentName(member.department_name),
  );
}

export function formatCreativeBriefingDimensions(
  width: string | number,
  height: string | number,
  unit: string,
) {
  if (unit !== "px" && unit !== "cm" && unit !== "mm") return null;

  const widthValue = Number(width);
  const heightValue = Number(height);
  if (
    !Number.isFinite(widthValue) ||
    !Number.isFinite(heightValue) ||
    widthValue <= 0 ||
    heightValue <= 0 ||
    widthValue > 1_000_000 ||
    heightValue > 1_000_000
  ) {
    return null;
  }

  return String(widthValue) + " \u00D7 " + String(heightValue) + " " + unit;
}

export interface CreativeBriefingDescriptionInput {
  designerNames: string[];
  requesterName?: string | null;
  brandName: string;
  videoSizes: string[];
  formats: string[];
  formatDescription?: string | null;
  brandRules?: string | null;
  description?: string | null;
  driveUrl?: string | null;
  driveFiles?: Array<{ name: string; url?: string | null }> | null;
  visualReferenceUrl?: string | null;
  referenceFileName?: string | null;
  referenceFileUrl?: string | null;
  priority: CreativeBriefingPriority;
  dueDate?: string | null;
  estimatedHours?: number | null;
}

const COPY: Record<
  CreativeBriefingLocale,
  {
    typeLabel: string;
    type: string;
    details: string;
    checklist: string;
    requester: string;
    designers: string;
    brand: string;
    videoSizes: string;
    formats: string;
    formatDescription: string;
    brandRules: string;
    description: string;
    driveUrl: string;
    driveFile: string;
    driveFileLink: string;
    visualReferenceUrl: string;
    referenceFile: string;
    priority: string;
    deadline: string;
    estimate: string;
    items: string[];
    titlePrefix: string;
  }
> = {
  en: {
    typeLabel: "Type",
    type: "Creative briefing",
    details: "Details",
    checklist: "Suggested checklist",
    requester: "Requester",
    designers: "Designers",
    brand: "Brand",
    videoSizes: "Video proportions and sizes",
    formats: "Formats",
    formatDescription: "Format description",
    brandRules: "Brand rules and conditions",
    description: "Description",
    driveUrl: "Drive / photos link",
    driveFile: "Drive / photos file",
    driveFileLink: "Drive / photos file link",
    visualReferenceUrl: "Visual reference URL",
    referenceFile: "Reference file",
    priority: "Priority",
    deadline: "Deadline",
    estimate: "Estimated time",
    items: [
      "Review the briefing",
      "Confirm brand assets",
      "Produce the requested creative",
      "Request review before delivery",
    ],
    titlePrefix: "Creative briefing",
  },
  "pt-BR": {
    typeLabel: "Tipo",
    type: "Briefing de criação",
    details: "Detalhes",
    checklist: "Checklist sugerido",
    requester: "Solicitante",
    designers: "Designers",
    brand: "Marca",
    videoSizes: "Proporções e tamanhos do vídeo",
    formats: "Formatos",
    formatDescription: "Descri\u00e7\u00e3o do formato",
    brandRules: "Regras e condições da marca",
    description: "Descrição",
    driveUrl: "Link de Drive / fotos",
    driveFile: "Arquivo do Drive / fotos",
    driveFileLink: "Link do arquivo do Drive / fotos",
    visualReferenceUrl: "URL de referência visual",
    referenceFile: "Arquivo de referência",
    priority: "Prioridade",
    deadline: "Prazo",
    estimate: "Tempo estimado",
    items: [
      "Revisar o briefing",
      "Confirmar os materiais da marca",
      "Produzir a peça solicitada",
      "Solicitar revisão antes da entrega",
    ],
    titlePrefix: "Briefing de criação",
  },
};

function singleLine(value: string | null | undefined) {
  return value?.replace(/[\r\n]+/g, " ").trim() ?? "";
}

function joinedValues(values: string[]) {
  return values
    .map((value) => singleLine(value))
    .filter(Boolean)
    .join(", ");
}

function labelForPriority(
  priority: CreativeBriefingPriority,
  locale: CreativeBriefingLocale,
) {
  if (locale === "pt-BR") {
    if (priority === "high") return "Alta";
    if (priority === "medium") return "Media";
    return "Baixa";
  }
  if (priority === "high") return "High";
  if (priority === "medium") return "Medium";
  return "Low";
}

export function buildCreativeBriefingTitle(
  brandName: string,
  format: string,
  locale: CreativeBriefingLocale = "en",
) {
  const copy = COPY[locale];
  const brand =
    singleLine(brandName) || (locale === "pt-BR" ? "marca" : "brand");
  const selectedFormat =
    singleLine(format) || (locale === "pt-BR" ? "criação" : "creative");
  return `${copy.titlePrefix}: ${brand} - ${selectedFormat}`;
}

export function buildCreativeBriefingDescription(
  input: CreativeBriefingDescriptionInput,
  locale: CreativeBriefingLocale = "en",
) {
  const copy = COPY[locale];
  const details: Array<[string, string]> = [
    [copy.requester, singleLine(input.requesterName)],
    [copy.designers, joinedValues(input.designerNames)],
    [copy.brand, input.brandName],
    [copy.videoSizes, joinedValues(input.videoSizes)],
    [copy.formats, joinedValues(input.formats)],
    [copy.priority, labelForPriority(input.priority, locale)],
  ];

  let detailIndex = 5;
  if (input.formatDescription) {
    details.splice(detailIndex, 0, [
      copy.formatDescription,
      input.formatDescription,
    ]);
    detailIndex += 1;
  }
  if (input.brandRules) {
    details.splice(detailIndex, 0, [copy.brandRules, input.brandRules]);
    detailIndex += 1;
  }
  if (input.description)
    details.splice(detailIndex, 0, [copy.description, input.description]);
  if (input.estimatedHours && input.estimatedHours > 0) {
    details.push([copy.estimate, String(input.estimatedHours) + "h"]);
  }
  if (input.dueDate) details.push([copy.deadline, input.dueDate]);
  if (input.driveUrl) details.push([copy.driveUrl, input.driveUrl]);
  for (const file of input.driveFiles ?? []) {
    const name = singleLine(file.name);
    if (!name) continue;
    details.push([copy.driveFile, name]);
    if (file.url) details.push([copy.driveFileLink, file.url]);
  }
  if (input.visualReferenceUrl)
    details.push([copy.visualReferenceUrl, input.visualReferenceUrl]);
  if (input.referenceFileName)
    details.push([copy.referenceFile, input.referenceFileName]);
  if (input.referenceFileUrl)
    details.push([`${copy.referenceFile} link`, input.referenceFileUrl]);

  return [
    "## UP Flow Task Brief",
    `${copy.typeLabel}: ${copy.type}`,
    "",
    `### ${copy.details}`,
    ...details
      .map(([label, value]) => [singleLine(label), singleLine(value)] as const)
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => `- ${label}: ${value}`),
    "",
    `### ${copy.checklist}`,
    ...copy.items.map((item) => `- [ ] ${item}`),
  ].join("\n");
}

export function addBusinessDaysToIsoDate(value: Date, days: number) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  let remaining = Math.max(0, Math.floor(days));

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
