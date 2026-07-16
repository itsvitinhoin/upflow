export type TaskTemplateId =
  | "general"
  | "creative"
  | "b2b_marketing"
  | "b2c_marketing"
  | "commercial"
  | "finance"
  | "production"
  | "technical_support"
  | "admin";

export interface TaskTemplateField {
  key: string;
  label: string;
  placeholder: string;
  kind?: "text" | "textarea";
}

export interface TaskTemplate {
  id: TaskTemplateId;
  label: string;
  description: string;
  fields: TaskTemplateField[];
  checklist: string[];
}

export type TaskTemplateLocale = "en" | "pt-BR";

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "general",
    label: "General task",
    description: "Simple work item with flexible notes.",
    fields: [
      { key: "objective", label: "Objective", placeholder: "What should be completed?", kind: "textarea" },
      { key: "requirements", label: "Requirements", placeholder: "Requirements, links, or context", kind: "textarea" },
    ],
    checklist: ["Confirm owner", "Confirm due date", "Complete work", "Review outcome"],
  },
  {
    id: "creative",
    label: "Creative / Design",
    description: "Asset production, design, and approval work.",
    fields: [
      { key: "asset_type", label: "Asset type", placeholder: "Static, reel, story, landing hero, carousel" },
      { key: "format", label: "Format / dimensions", placeholder: "1080x1350, 9:16, 1:1, web banner" },
      { key: "platform", label: "Platform", placeholder: "Instagram, TikTok, Meta Ads, website" },
      { key: "references", label: "References", placeholder: "Links, inspiration, brand assets", kind: "textarea" },
      { key: "approval_owner", label: "Approval owner", placeholder: "Internal or client approver" },
    ],
    checklist: ["Brief complete", "Assets attached", "Design draft", "Internal review", "Client review", "Approved"],
  },
  {
    id: "b2b_marketing",
    label: "B2B Marketing",
    description: "Lead generation, outbound, and account-based campaigns.",
    fields: [
      { key: "target_account", label: "Target account / segment", placeholder: "Companies, vertical, or ICP" },
      { key: "persona", label: "Persona", placeholder: "CEO, founder, marketing manager, buyer" },
      { key: "funnel_stage", label: "Funnel stage", placeholder: "Awareness, demo, proposal, closing" },
      { key: "offer", label: "Offer", placeholder: "Audit, consultation, case study, demo" },
      { key: "channel", label: "Channel", placeholder: "LinkedIn, email, Google Ads, outbound" },
      { key: "cta", label: "CTA", placeholder: "Book a call, request audit, download asset" },
      { key: "sales_owner", label: "Sales owner", placeholder: "Who owns follow-up?" },
    ],
    checklist: ["Audience confirmed", "Offer approved", "Copy written", "Creative ready", "Tracking ready", "Follow-up owner set"],
  },
  {
    id: "b2c_marketing",
    label: "B2C Marketing",
    description: "Consumer campaigns, launches, ads, and content.",
    fields: [
      { key: "product", label: "Product / service", placeholder: "Product, collection, or offer" },
      { key: "audience", label: "Audience segment", placeholder: "Age, location, interest, behavior" },
      { key: "objective", label: "Campaign objective", placeholder: "Reach, engagement, traffic, leads, sales" },
      { key: "creative_format", label: "Creative format", placeholder: "Reel, story, static, carousel, ad copy" },
      { key: "promotion", label: "Offer / promotion", placeholder: "Discount, launch, bundle, deadline" },
      { key: "budget", label: "Budget", placeholder: "Daily or campaign budget" },
    ],
    checklist: ["Offer confirmed", "Creative produced", "Copy approved", "Audience configured", "Campaign scheduled", "Results checked"],
  },
  {
    id: "commercial",
    label: "Commercial",
    description: "Sales, proposals, contracts, follow-up, and commissions.",
    fields: [
      { key: "lead_company", label: "Lead / company", placeholder: "Company or opportunity name" },
      { key: "contact", label: "Contact person", placeholder: "Decision maker or buyer" },
      { key: "deal_stage", label: "Deal stage", placeholder: "Qualified, proposal, negotiation, won/lost" },
      { key: "expected_value", label: "Expected value", placeholder: "Contract or project value" },
      { key: "follow_up", label: "Next follow-up", placeholder: "Date, channel, and next step" },
      { key: "commission", label: "Commission", placeholder: "Percent, value, or owner" },
    ],
    checklist: ["Lead qualified", "Proposal prepared", "Follow-up scheduled", "Contract reviewed", "Handoff ready"],
  },
  {
    id: "finance",
    label: "Finance",
    description: "Invoices, payments, commissions, expenses, and cashflow.",
    fields: [
      { key: "client", label: "Client / company", placeholder: "Who is this finance task for?" },
      { key: "amount", label: "Amount", placeholder: "Invoice, payment, expense, or commission value" },
      { key: "payment_status", label: "Payment status", placeholder: "Pending, sent, waiting payment, paid, overdue" },
      { key: "invoice_number", label: "Invoice number", placeholder: "Invoice or receipt reference" },
      { key: "billing_cycle", label: "Billing cycle", placeholder: "Monthly, quarterly, annual, project" },
      { key: "payment_method", label: "Payment method", placeholder: "Pix, card, transfer, boleto" },
    ],
    checklist: ["Amount confirmed", "Invoice/receipt attached", "Payment owner set", "Due date confirmed", "Marked paid when received"],
  },
  {
    id: "production",
    label: "Production",
    description: "Shoots, editing, publishing, deliverables, and production handoffs.",
    fields: [
      { key: "deliverable", label: "Deliverable", placeholder: "Video, reels batch, photo set, podcast, edit package" },
      { key: "shoot_date", label: "Shoot / production date", placeholder: "Date and call time" },
      { key: "location", label: "Location", placeholder: "Studio, client site, remote, event venue" },
      { key: "format", label: "Format / specs", placeholder: "9:16, 16:9, 4K, captions, thumbnails" },
      { key: "publishing_channel", label: "Publishing channel", placeholder: "Instagram, YouTube, TikTok, client delivery" },
      { key: "handoff_owner", label: "Handoff owner", placeholder: "Editor, producer, client approver" },
    ],
    checklist: [
      "Pre-production confirmed",
      "Assets and equipment ready",
      "Shoot or capture complete",
      "Editing complete",
      "Review approved",
      "Delivered or published",
    ],
  },
  {
    id: "technical_support",
    label: "Technical Support",
    description: "Support tickets, bug reports, access issues, escalations, and resolution notes.",
    fields: [
      { key: "client", label: "Client / requester", placeholder: "Client, team member, or department" },
      { key: "issue_type", label: "Issue type", placeholder: "Bug, access, setup, request, question" },
      { key: "severity", label: "Severity / SLA", placeholder: "Critical, high, normal, low; response deadline" },
      { key: "system", label: "System / platform", placeholder: "Website, Meta, GA4, Vesti, CRM, email, UP Flow" },
      { key: "impact", label: "Impact", placeholder: "Who is blocked and what work is affected?", kind: "textarea" },
      { key: "reproduction", label: "Steps / evidence", placeholder: "Steps, screenshots, links, error messages", kind: "textarea" },
      { key: "resolution", label: "Resolution notes", placeholder: "Fix applied, workaround, or next escalation", kind: "textarea" },
    ],
    checklist: [
      "Classify severity",
      "Confirm requester and affected client",
      "Collect evidence",
      "Assign owner",
      "Communicate status",
      "Resolve or escalate",
      "Confirm with requester",
    ],
  },
  {
    id: "admin",
    label: "General Admin",
    description: "Internal operations, access, documents, suppliers, and approvals.",
    fields: [
      { key: "request_type", label: "Request type", placeholder: "Access, document, HR, supplier, operation" },
      { key: "requester", label: "Requester", placeholder: "Person or department requesting" },
      { key: "department", label: "Department", placeholder: "Commercial, finance, creative, operations" },
      { key: "approval_needed", label: "Approval needed", placeholder: "Approver and approval condition" },
      { key: "required_file", label: "Required document/file", placeholder: "Contract, access, receipt, brief, ID" },
      { key: "vendor", label: "Vendor / supplier", placeholder: "External provider if relevant" },
    ],
    checklist: ["Requester confirmed", "Required file attached", "Approver set", "Action completed", "Requester notified"],
  },
];

export const DEFAULT_TASK_TEMPLATE_ID: TaskTemplateId = "general";

type TaskTemplateCopy = Pick<TaskTemplate, "label" | "description" | "checklist"> & {
  fields: Record<string, Pick<TaskTemplateField, "label" | "placeholder">>;
};

const PORTUGUESE_TEMPLATE_COPY: Record<TaskTemplateId, TaskTemplateCopy> = {
  general: {
    label: "Tarefa geral",
    description: "Item simples de trabalho com notas flexíveis.",
    fields: {
      objective: { label: "Objetivo", placeholder: "O que precisa ser concluído?" },
      requirements: { label: "Requisitos", placeholder: "Requisitos, links ou contexto" },
    },
    checklist: ["Confirmar responsável", "Confirmar data de vencimento", "Concluir trabalho", "Revisar resultado"],
  },
  creative: {
    label: "Criação / Design",
    description: "Produção de peças, design e aprovações.",
    fields: {
      asset_type: { label: "Tipo de peça", placeholder: "Estático, reel, story, hero de landing page ou carrossel" },
      format: { label: "Formato / dimensões", placeholder: "1080x1350, 9:16, 1:1 ou banner web" },
      platform: { label: "Plataforma", placeholder: "Instagram, TikTok, Meta Ads ou site" },
      references: { label: "Referências", placeholder: "Links, inspirações ou materiais da marca" },
      approval_owner: { label: "Responsável pela aprovação", placeholder: "Aprovador interno ou do cliente" },
    },
    checklist: ["Briefing concluído", "Materiais anexados", "Rascunho de design", "Revisão interna", "Revisão do cliente", "Aprovado"],
  },
  b2b_marketing: {
    label: "Marketing B2B",
    description: "Geração de leads, outbound e campanhas baseadas em contas.",
    fields: {
      target_account: { label: "Conta / segmento-alvo", placeholder: "Empresas, vertical ou ICP" },
      persona: { label: "Persona", placeholder: "CEO, fundador, gerente de marketing ou comprador" },
      funnel_stage: { label: "Etapa do funil", placeholder: "Descoberta, demonstração, proposta ou fechamento" },
      offer: { label: "Oferta", placeholder: "Auditoria, consultoria, case ou demonstração" },
      channel: { label: "Canal", placeholder: "LinkedIn, e-mail, Google Ads ou outbound" },
      cta: { label: "CTA", placeholder: "Agendar uma conversa, solicitar auditoria ou baixar material" },
      sales_owner: { label: "Responsável comercial", placeholder: "Quem é responsável pelo follow-up?" },
    },
    checklist: ["Público confirmado", "Oferta aprovada", "Texto produzido", "Criativo pronto", "Rastreamento pronto", "Responsável pelo follow-up definido"],
  },
  b2c_marketing: {
    label: "Marketing B2C",
    description: "Campanhas de consumo, lançamentos, anúncios e conteúdo.",
    fields: {
      product: { label: "Produto / serviço", placeholder: "Produto, coleção ou oferta" },
      audience: { label: "Segmento de público", placeholder: "Idade, localização, interesse ou comportamento" },
      objective: { label: "Objetivo da campanha", placeholder: "Alcance, engajamento, tráfego, leads ou vendas" },
      creative_format: { label: "Formato criativo", placeholder: "Reel, story, peça estática, carrossel ou texto de anúncio" },
      promotion: { label: "Oferta / promoção", placeholder: "Desconto, lançamento, pacote ou prazo" },
      budget: { label: "Orçamento", placeholder: "Orçamento diário ou da campanha" },
    },
    checklist: ["Oferta confirmada", "Criativo produzido", "Texto aprovado", "Público configurado", "Campanha agendada", "Resultados verificados"],
  },
  commercial: {
    label: "Comercial",
    description: "Vendas, propostas, contratos, follow-up e comissões.",
    fields: {
      lead_company: { label: "Lead / empresa", placeholder: "Nome da empresa ou oportunidade" },
      contact: { label: "Pessoa de contato", placeholder: "Tomador de decisão ou comprador" },
      deal_stage: { label: "Etapa da negociação", placeholder: "Qualificado, proposta, negociação, ganho ou perdido" },
      expected_value: { label: "Valor esperado", placeholder: "Valor do contrato ou projeto" },
      follow_up: { label: "Próximo follow-up", placeholder: "Data, canal e próximo passo" },
      commission: { label: "Comissão", placeholder: "Percentual, valor ou responsável" },
    },
    checklist: ["Lead qualificado", "Proposta preparada", "Follow-up agendado", "Contrato revisado", "Repasse pronto"],
  },
  finance: {
    label: "Financeiro",
    description: "Faturas, pagamentos, comissões, despesas e fluxo de caixa.",
    fields: {
      client: { label: "Cliente / empresa", placeholder: "Para quem é esta tarefa financeira?" },
      amount: { label: "Valor", placeholder: "Valor da fatura, pagamento, despesa ou comissão" },
      payment_status: { label: "Status do pagamento", placeholder: "Pendente, enviado, aguardando pagamento, pago ou vencido" },
      invoice_number: { label: "Número da fatura", placeholder: "Referência da fatura ou recibo" },
      billing_cycle: { label: "Ciclo de cobrança", placeholder: "Mensal, trimestral, anual ou por projeto" },
      payment_method: { label: "Forma de pagamento", placeholder: "Pix, cartão, transferência ou boleto" },
    },
    checklist: ["Valor confirmado", "Fatura ou recibo anexado", "Responsável pelo pagamento definido", "Data de vencimento confirmada", "Marcado como pago quando recebido"],
  },
  production: {
    label: "Produção",
    description: "Gravações, edição, publicação, entregáveis e repasses de produção.",
    fields: {
      deliverable: { label: "Entregável", placeholder: "Vídeo, lote de reels, fotos, podcast ou pacote de edição" },
      shoot_date: { label: "Data de gravação / produção", placeholder: "Data e horário de chamada" },
      location: { label: "Local", placeholder: "Estúdio, cliente, remoto ou local do evento" },
      format: { label: "Formato / especificações", placeholder: "9:16, 16:9, 4K, legendas ou thumbnails" },
      publishing_channel: { label: "Canal de publicação", placeholder: "Instagram, YouTube, TikTok ou entrega ao cliente" },
      handoff_owner: { label: "Responsável pelo repasse", placeholder: "Editor, produtor ou aprovador do cliente" },
    },
    checklist: ["Pré-produção confirmada", "Materiais e equipamentos prontos", "Gravação ou captura concluída", "Edição concluída", "Revisão aprovada", "Entregue ou publicado"],
  },
  technical_support: {
    label: "Suporte técnico",
    description: "Tickets de suporte, bugs, acessos, escalações e notas de resolução.",
    fields: {
      client: { label: "Cliente / solicitante", placeholder: "Cliente, membro da equipe ou departamento" },
      issue_type: { label: "Tipo de problema", placeholder: "Bug, acesso, configuração, solicitação ou dúvida" },
      severity: { label: "Gravidade / SLA", placeholder: "Crítica, alta, normal ou baixa; prazo de resposta" },
      system: { label: "Sistema / plataforma", placeholder: "Site, Meta, GA4, Vesti, CRM, e-mail ou UP Flow" },
      impact: { label: "Impacto", placeholder: "Quem está bloqueado e qual trabalho foi afetado?" },
      reproduction: { label: "Passos / evidências", placeholder: "Passos, capturas de tela, links ou mensagens de erro" },
      resolution: { label: "Notas de resolução", placeholder: "Correção aplicada, alternativa ou próxima escalação" },
    },
    checklist: ["Classificar gravidade", "Confirmar solicitante e cliente afetado", "Coletar evidências", "Atribuir responsável", "Comunicar status", "Resolver ou escalar", "Confirmar com solicitante"],
  },
  admin: {
    label: "Administrativo geral",
    description: "Operações internas, acessos, documentos, fornecedores e aprovações.",
    fields: {
      request_type: { label: "Tipo de solicitação", placeholder: "Acesso, documento, RH, fornecedor ou operação" },
      requester: { label: "Solicitante", placeholder: "Pessoa ou departamento solicitante" },
      department: { label: "Departamento", placeholder: "Comercial, financeiro, criação ou operações" },
      approval_needed: { label: "Aprovação necessária", placeholder: "Aprovador e condição de aprovação" },
      required_file: { label: "Documento / arquivo necessário", placeholder: "Contrato, acesso, recibo, briefing ou documento de identidade" },
      vendor: { label: "Fornecedor", placeholder: "Prestador externo, se relevante" },
    },
    checklist: ["Solicitante confirmado", "Arquivo necessário anexado", "Aprovador definido", "Ação concluída", "Solicitante notificado"],
  },
};

const TASK_BRIEF_COPY: Record<TaskTemplateLocale, {
  type: string;
  details: string;
  notes: string;
  suggestedChecklist: string;
  fallbackType: string;
}> = {
  en: {
    type: "Type",
    details: "Details",
    notes: "Notes",
    suggestedChecklist: "Suggested checklist",
    fallbackType: "Structured task",
  },
  "pt-BR": {
    type: "Tipo",
    details: "Detalhes",
    notes: "Notas",
    suggestedChecklist: "Checklist sugerido",
    fallbackType: "Tarefa estruturada",
  },
};

export function getTaskTemplate(id: string | undefined | null) {
  return TASK_TEMPLATES.find((template) => template.id === id) ?? TASK_TEMPLATES[0];
}

export function getLocalizedTaskTemplate(
  id: string | undefined | null,
  locale: TaskTemplateLocale = "en",
) {
  const template = getTaskTemplate(id);
  if (locale !== "pt-BR") return template;

  const copy = PORTUGUESE_TEMPLATE_COPY[template.id];
  return {
    ...template,
    label: copy.label,
    description: copy.description,
    fields: template.fields.map((field) => ({
      ...field,
      ...copy.fields[field.key],
    })),
    checklist: copy.checklist,
  };
}

const TASK_TITLE_FIELD_PRIORITY = [
  "objective",
  "deliverable",
  "asset_type",
  "target_account",
  "product",
  "lead_company",
  "client",
  "request_type",
  "issue_type",
  "offer",
  "campaign",
  "task",
  "title",
] as const;

export function getTaskTitleFromTemplateValues(values: Record<string, string>) {
  for (const key of TASK_TITLE_FIELD_PRIORITY) {
    const value = values[key]?.trim();
    if (value) return value;
  }

  return Object.values(values).find((value) => value.trim().length > 0)?.trim() ?? "";
}

export function buildTaskBrief(input: {
  templateId: TaskTemplateId;
  values: Record<string, string>;
  notes?: string | null;
  locale?: TaskTemplateLocale;
}) {
  const locale = input.locale ?? "en";
  const template = getLocalizedTaskTemplate(input.templateId, locale);
  const briefCopy = TASK_BRIEF_COPY[locale];
  const lines = [
    "## UP Flow Task Brief",
    `${briefCopy.type}: ${template.label}`,
    "",
    `### ${briefCopy.details}`,
  ];

  for (const field of template.fields) {
    const value = input.values[field.key]?.trim();
    if (value) lines.push(`- ${field.label}: ${value}`);
  }

  if (input.notes?.trim()) {
    lines.push("", `### ${briefCopy.notes}`, input.notes.trim());
  }

  if (template.checklist.length > 0) {
    lines.push("", `### ${briefCopy.suggestedChecklist}`);
    for (const item of template.checklist) lines.push(`- [ ] ${item}`);
  }

  return lines.join("\n").trim();
}

export function parseTaskBrief(
  description: string | null | undefined,
  locale: TaskTemplateLocale = "en",
) {
  if (!description?.startsWith("## UP Flow Task Brief")) return null;
  const type = description.match(/^(?:Type|Tipo):\s*(.+)$/m)?.[1]?.trim() ?? TASK_BRIEF_COPY[locale].fallbackType;
  const details = Array.from(description.matchAll(/^- ([^:]+):\s*(.+)$/gm)).map((match) => ({
    label: match[1],
    value: match[2],
  }));
  const checklist = Array.from(description.matchAll(/^- \[ \]\s*(.+)$/gm)).map((match) => match[1]);
  return { type, details, checklist };
}
