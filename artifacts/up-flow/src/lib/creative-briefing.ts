export type CreativeBriefingLocale = "en" | "pt-BR";

export type CreativeBriefingPriority = "low" | "medium" | "high";

export interface CreativeBriefingDescriptionInput {
  designerNames: string[];
  brandName: string;
  videoSizes: string[];
  formats: string[];
  brandRules?: string | null;
  description?: string | null;
  driveUrl?: string | null;
  driveFiles?: Array<{ name: string; url?: string | null }> | null;
  visualReferenceUrl?: string | null;
  referenceFileName?: string | null;
  referenceFileUrl?: string | null;
  priority: CreativeBriefingPriority;
  dueDate?: string | null;
  estimatedHours: number;
}

const COPY: Record<CreativeBriefingLocale, {
  typeLabel: string;
  type: string;
  details: string;
  checklist: string;
  designers: string;
  brand: string;
  videoSizes: string;
  formats: string;
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
}> = {
  en: {
    typeLabel: "Type",
    type: "Creative briefing",
    details: "Details",
    checklist: "Suggested checklist",
    designers: "Designers",
    brand: "Brand",
    videoSizes: "Video proportions and sizes",
    formats: "Formats",
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
    designers: "Designers",
    brand: "Marca",
    videoSizes: "Proporções e tamanhos do vídeo",
    formats: "Formatos",
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
  return values.map((value) => singleLine(value)).filter(Boolean).join(", ");
}

function labelForPriority(priority: CreativeBriefingPriority, locale: CreativeBriefingLocale) {
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
  const brand = singleLine(brandName) || (locale === "pt-BR" ? "marca" : "brand");
  const selectedFormat = singleLine(format) || (locale === "pt-BR" ? "criação" : "creative");
  return `${copy.titlePrefix}: ${brand} - ${selectedFormat}`;
}

export function buildCreativeBriefingDescription(
  input: CreativeBriefingDescriptionInput,
  locale: CreativeBriefingLocale = "en",
) {
  const copy = COPY[locale];
  const details: Array<[string, string]> = [
    [copy.designers, joinedValues(input.designerNames)],
    [copy.brand, input.brandName],
    [copy.videoSizes, joinedValues(input.videoSizes)],
    [copy.formats, joinedValues(input.formats)],
    [copy.priority, labelForPriority(input.priority, locale)],
    [copy.estimate, `${input.estimatedHours}h`],
  ];

  if (input.brandRules) details.splice(4, 0, [copy.brandRules, input.brandRules]);
  if (input.description) details.splice(5, 0, [copy.description, input.description]);
  if (input.dueDate) details.push([copy.deadline, input.dueDate]);
  if (input.driveUrl) details.push([copy.driveUrl, input.driveUrl]);
  for (const file of input.driveFiles ?? []) {
    const name = singleLine(file.name);
    if (!name) continue;
    details.push([copy.driveFile, name]);
    if (file.url) details.push([copy.driveFileLink, file.url]);
  }
  if (input.visualReferenceUrl) details.push([copy.visualReferenceUrl, input.visualReferenceUrl]);
  if (input.referenceFileName) details.push([copy.referenceFile, input.referenceFileName]);
  if (input.referenceFileUrl) details.push([`${copy.referenceFile} link`, input.referenceFileUrl]);

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
