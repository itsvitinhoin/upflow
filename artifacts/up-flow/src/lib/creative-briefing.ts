export type CreativeBriefingLocale = "en" | "pt-BR";

export type CreativeBriefingPriority = "low" | "medium" | "high";

export interface CreativeBriefingDescriptionInput {
  designerName: string;
  brandName: string;
  videoSize: string;
  format: string;
  brandRules: string;
  driveUrl?: string | null;
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
  designer: string;
  brand: string;
  videoSize: string;
  format: string;
  brandRules: string;
  driveUrl: string;
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
    designer: "Designer",
    brand: "Brand",
    videoSize: "Video proportion and size",
    format: "Format",
    brandRules: "Brand rules and conditions",
    driveUrl: "Drive / photos link",
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
    designer: "Designer",
    brand: "Marca",
    videoSize: "Proporção e tamanho do vídeo",
    format: "Formato",
    brandRules: "Regras e condições da marca",
    driveUrl: "Link de Drive / fotos",
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
    [copy.designer, input.designerName],
    [copy.brand, input.brandName],
    [copy.videoSize, input.videoSize],
    [copy.format, input.format],
    [copy.brandRules, input.brandRules],
    [copy.priority, labelForPriority(input.priority, locale)],
    [copy.estimate, `${input.estimatedHours}h`],
  ];

  if (input.dueDate) details.push([copy.deadline, input.dueDate]);
  if (input.driveUrl) details.push([copy.driveUrl, input.driveUrl]);
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
