import type { TaskTemplateId } from "@/lib/task-templates";

export type TaskTemplateLanguage = "en" | "pt-BR";

interface TaskTemplateFieldCopy {
  label: string;
  placeholder: string;
}

interface TaskTemplateCopy {
  label: string;
  description: string;
  fields: Record<string, TaskTemplateFieldCopy>;
  checklist: string[];
}

const BRIEF_COPY: Record<TaskTemplateLanguage, Record<string, string>> = {
  en: {
    "taskTemplate.brief.type": "Type",
    "taskTemplate.brief.details": "Details",
    "taskTemplate.brief.notes": "Notes",
    "taskTemplate.brief.checklist": "Suggested checklist",
  },
  "pt-BR": {
    "taskTemplate.brief.type": "Tipo",
    "taskTemplate.brief.details": "Detalhes",
    "taskTemplate.brief.notes": "Notas",
    "taskTemplate.brief.checklist": "Checklist sugerido",
  },
};

export const TASK_TEMPLATE_COPY: Record<
  TaskTemplateLanguage,
  Record<TaskTemplateId, TaskTemplateCopy>
> = {
  en: {
    general: {
      label: "General task",
      description: "Simple work item with flexible notes.",
      fields: {
        objective: { label: "Objective", placeholder: "What should be completed?" },
        requirements: { label: "Requirements", placeholder: "Requirements, links, or context" },
      },
      checklist: ["Confirm owner", "Confirm due date", "Complete work", "Review outcome"],
    },
    creative: {
      label: "Creative / Design",
      description: "Asset production, design, and approval work.",
      fields: {
        asset_type: { label: "Asset type", placeholder: "Static, reel, story, landing hero, carousel" },
        format: { label: "Format / dimensions", placeholder: "1080x1350, 9:16, 1:1, web banner" },
        platform: { label: "Platform", placeholder: "Instagram, TikTok, Meta Ads, website" },
        references: { label: "References", placeholder: "Links, inspiration, brand assets" },
        approval_owner: { label: "Approval owner", placeholder: "Internal or client approver" },
      },
      checklist: ["Brief complete", "Assets attached", "Design draft", "Internal review", "Client review", "Approved"],
    },
    b2b_marketing: {
      label: "B2B Marketing",
      description: "Lead generation, outbound, and account-based campaigns.",
      fields: {
        target_account: { label: "Target account / segment", placeholder: "Companies, vertical, or ICP" },
        persona: { label: "Persona", placeholder: "CEO, founder, marketing manager, buyer" },
        funnel_stage: { label: "Funnel stage", placeholder: "Awareness, demo, proposal, closing" },
        offer: { label: "Offer", placeholder: "Audit, consultation, case study, demo" },
        channel: { label: "Channel", placeholder: "LinkedIn, email, Google Ads, outbound" },
        cta: { label: "CTA", placeholder: "Book a call, request audit, download asset" },
        sales_owner: { label: "Sales owner", placeholder: "Who owns follow-up?" },
      },
      checklist: ["Audience confirmed", "Offer approved", "Copy written", "Creative ready", "Tracking ready", "Follow-up owner set"],
    },
    b2c_marketing: {
      label: "B2C Marketing",
      description: "Consumer campaigns, launches, ads, and content.",
      fields: {
        product: { label: "Product / service", placeholder: "Product, collection, or offer" },
        audience: { label: "Audience segment", placeholder: "Age, location, interest, behavior" },
        objective: { label: "Campaign objective", placeholder: "Reach, engagement, traffic, leads, sales" },
        creative_format: { label: "Creative format", placeholder: "Reel, story, static, carousel, ad copy" },
        promotion: { label: "Offer / promotion", placeholder: "Discount, launch, bundle, deadline" },
        budget: { label: "Budget", placeholder: "Daily or campaign budget" },
      },
      checklist: ["Offer confirmed", "Creative produced", "Copy approved", "Audience configured", "Campaign scheduled", "Results checked"],
    },
    commercial: {
      label: "Commercial",
      description: "Sales, proposals, contracts, follow-up, and commissions.",
      fields: {
        lead_company: { label: "Lead / company", placeholder: "Company or opportunity name" },
        contact: { label: "Contact person", placeholder: "Decision maker or buyer" },
        deal_stage: { label: "Deal stage", placeholder: "Qualified, proposal, negotiation, won/lost" },
        expected_value: { label: "Expected value", placeholder: "Contract or project value" },
        follow_up: { label: "Next follow-up", placeholder: "Date, channel, and next step" },
        commission: { label: "Commission", placeholder: "Percent, value, or owner" },
      },
      checklist: ["Lead qualified", "Proposal prepared", "Follow-up scheduled", "Contract reviewed", "Handoff ready"],
    },
    finance: {
      label: "Finance",
      description: "Invoices, payments, commissions, expenses, and cashflow.",
      fields: {
        client: { label: "Client / company", placeholder: "Who is this finance task for?" },
        amount: { label: "Amount", placeholder: "Invoice, payment, expense, or commission value" },
        payment_status: { label: "Payment status", placeholder: "Pending, sent, waiting payment, paid, overdue" },
        invoice_number: { label: "Invoice number", placeholder: "Invoice or receipt reference" },
        billing_cycle: { label: "Billing cycle", placeholder: "Monthly, quarterly, annual, project" },
        payment_method: { label: "Payment method", placeholder: "Pix, card, transfer, boleto" },
      },
      checklist: ["Amount confirmed", "Invoice/receipt attached", "Payment owner set", "Due date confirmed", "Marked paid when received"],
    },
    production: {
      label: "Production",
      description: "Shoots, editing, publishing, deliverables, and production handoffs.",
      fields: {
        deliverable: { label: "Deliverable", placeholder: "Video, reels batch, photo set, podcast, edit package" },
        shoot_date: { label: "Shoot / production date", placeholder: "Date and call time" },
        location: { label: "Location", placeholder: "Studio, client site, remote, event venue" },
        format: { label: "Format / specs", placeholder: "9:16, 16:9, 4K, captions, thumbnails" },
        publishing_channel: { label: "Publishing channel", placeholder: "Instagram, YouTube, TikTok, client delivery" },
        handoff_owner: { label: "Handoff owner", placeholder: "Editor, producer, client approver" },
      },
      checklist: ["Pre-production confirmed", "Assets and equipment ready", "Shoot or capture complete", "Editing complete", "Review approved", "Delivered or published"],
    },
    technical_support: {
      label: "Technical Support",
      description: "Support tickets, bug reports, access issues, escalations, and resolution notes.",
      fields: {
        client: { label: "Client / requester", placeholder: "Client, team member, or department" },
        issue_type: { label: "Issue type", placeholder: "Bug, access, setup, request, question" },
        severity: { label: "Severity / SLA", placeholder: "Critical, high, normal, low; response deadline" },
        system: { label: "System / platform", placeholder: "Website, Meta, GA4, Vesti, CRM, email, UP Flow" },
        impact: { label: "Impact", placeholder: "Who is blocked and what work is affected?" },
        reproduction: { label: "Steps / evidence", placeholder: "Steps, screenshots, links, error messages" },
        resolution: { label: "Resolution notes", placeholder: "Fix applied, workaround, or next escalation" },
      },
      checklist: ["Classify severity", "Confirm requester and affected client", "Collect evidence", "Assign owner", "Communicate status", "Resolve or escalate", "Confirm with requester"],
    },
    admin: {
      label: "General Admin",
      description: "Internal operations, access, documents, suppliers, and approvals.",
      fields: {
        request_type: { label: "Request type", placeholder: "Access, document, HR, supplier, operation" },
        requester: { label: "Requester", placeholder: "Person or department requesting" },
        department: { label: "Department", placeholder: "Commercial, finance, creative, operations" },
        approval_needed: { label: "Approval needed", placeholder: "Approver and approval condition" },
        required_file: { label: "Required document/file", placeholder: "Contract, access, receipt, brief, ID" },
        vendor: { label: "Vendor / supplier", placeholder: "External provider if relevant" },
      },
      checklist: ["Requester confirmed", "Required file attached", "Approver set", "Action completed", "Requester notified"],
    },
  },
  "pt-BR": {
    general: {
      label: "Tarefa geral",
      description: "Item de trabalho simples com notas flexíveis.",
      fields: {
        objective: { label: "Objetivo", placeholder: "O que deve ser concluído?" },
        requirements: { label: "Requisitos", placeholder: "Requisitos, links ou contexto" },
      },
      checklist: ["Confirmar responsável", "Confirmar prazo", "Concluir o trabalho", "Revisar o resultado"],
    },
    creative: {
      label: "Criativo / Design",
      description: "Produção de peças, design e aprovações.",
      fields: {
        asset_type: { label: "Tipo de peça", placeholder: "Estático, reel, story, destaque de landing page, carrossel" },
        format: { label: "Formato / dimensões", placeholder: "1080x1350, 9:16, 1:1, banner para web" },
        platform: { label: "Plataforma", placeholder: "Instagram, TikTok, Meta Ads, site" },
        references: { label: "Referências", placeholder: "Links, inspirações ou materiais da marca" },
        approval_owner: { label: "Responsável pela aprovação", placeholder: "Aprovador interno ou do cliente" },
      },
      checklist: ["Briefing concluído", "Materiais anexados", "Primeira versão do design", "Revisão interna", "Revisão do cliente", "Aprovado"],
    },
    b2b_marketing: {
      label: "Marketing B2B",
      description: "Geração de leads, outbound e campanhas baseadas em contas.",
      fields: {
        target_account: { label: "Conta / segmento-alvo", placeholder: "Empresas, setor ou ICP" },
        persona: { label: "Persona", placeholder: "CEO, fundador, gestor de marketing ou comprador" },
        funnel_stage: { label: "Etapa do funil", placeholder: "Reconhecimento, demonstração, proposta ou fechamento" },
        offer: { label: "Oferta", placeholder: "Auditoria, consultoria, estudo de caso ou demonstração" },
        channel: { label: "Canal", placeholder: "LinkedIn, e-mail, Google Ads ou outbound" },
        cta: { label: "Chamada para ação (CTA)", placeholder: "Agendar uma conversa, solicitar auditoria ou baixar material" },
        sales_owner: { label: "Responsável comercial", placeholder: "Quem é responsável pelo follow-up?" },
      },
      checklist: ["Público confirmado", "Oferta aprovada", "Texto redigido", "Criativo pronto", "Rastreamento pronto", "Responsável pelo follow-up definido"],
    },
    b2c_marketing: {
      label: "Marketing B2C",
      description: "Campanhas para consumidores, lançamentos, anúncios e conteúdo.",
      fields: {
        product: { label: "Produto / serviço", placeholder: "Produto, coleção ou oferta" },
        audience: { label: "Segmento de público", placeholder: "Idade, localização, interesse ou comportamento" },
        objective: { label: "Objetivo da campanha", placeholder: "Alcance, engajamento, tráfego, leads ou vendas" },
        creative_format: { label: "Formato criativo", placeholder: "Reel, story, estático, carrossel ou texto de anúncio" },
        promotion: { label: "Oferta / promoção", placeholder: "Desconto, lançamento, combo ou prazo" },
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
        deal_stage: { label: "Etapa da negociação", placeholder: "Qualificado, proposta, negociação, ganho/perdido" },
        expected_value: { label: "Valor esperado", placeholder: "Valor do contrato ou projeto" },
        follow_up: { label: "Próximo follow-up", placeholder: "Data, canal e próximo passo" },
        commission: { label: "Comissão", placeholder: "Percentual, valor ou responsável" },
      },
      checklist: ["Lead qualificado", "Proposta preparada", "Follow-up agendado", "Contrato revisado", "Repasse pronto"],
    },
    finance: {
      label: "Financeiro",
      description: "Notas fiscais, pagamentos, comissões, despesas e fluxo de caixa.",
      fields: {
        client: { label: "Cliente / empresa", placeholder: "Para quem é esta tarefa financeira?" },
        amount: { label: "Valor", placeholder: "Valor da nota, pagamento, despesa ou comissão" },
        payment_status: { label: "Status do pagamento", placeholder: "Pendente, enviado, aguardando pagamento, pago, vencido" },
        invoice_number: { label: "Número da nota fiscal", placeholder: "Referência da nota fiscal ou recibo" },
        billing_cycle: { label: "Ciclo de cobrança", placeholder: "Mensal, trimestral, anual ou por projeto" },
        payment_method: { label: "Forma de pagamento", placeholder: "Pix, cartão, transferência ou boleto" },
      },
      checklist: ["Valor confirmado", "Nota fiscal ou recibo anexado", "Responsável pelo pagamento definido", "Data de vencimento confirmada", "Marcado como pago após o recebimento"],
    },
    production: {
      label: "Produção",
      description: "Gravações, edição, publicação, entregáveis e repasses de produção.",
      fields: {
        deliverable: { label: "Entregável", placeholder: "Vídeo, lote de reels, fotos, podcast ou pacote de edição" },
        shoot_date: { label: "Data de gravação / produção", placeholder: "Data e horário de chamada" },
        location: { label: "Local", placeholder: "Estúdio, cliente, remoto ou local do evento" },
        format: { label: "Formato / especificações", placeholder: "9:16, 16:9, 4K, legendas, miniaturas" },
        publishing_channel: { label: "Canal de publicação", placeholder: "Instagram, YouTube, TikTok ou entrega ao cliente" },
        handoff_owner: { label: "Responsável pelo repasse", placeholder: "Editor, produtor ou aprovador do cliente" },
      },
      checklist: ["Pré-produção confirmada", "Materiais e equipamentos prontos", "Gravação ou captura concluída", "Edição concluída", "Revisão aprovada", "Entregue ou publicado"],
    },
    technical_support: {
      label: "Suporte técnico",
      description: "Chamados de suporte, bugs, problemas de acesso, escalações e notas de resolução.",
      fields: {
        client: { label: "Cliente / solicitante", placeholder: "Cliente, membro da equipe ou departamento" },
        issue_type: { label: "Tipo de problema", placeholder: "Bug, acesso, configuração, solicitação ou dúvida" },
        severity: { label: "Gravidade / SLA", placeholder: "Crítica, alta, normal, baixa; prazo de resposta" },
        system: { label: "Sistema / plataforma", placeholder: "Site, Meta, GA4, Vesti, CRM, e-mail, UP Flow" },
        impact: { label: "Impacto", placeholder: "Quem está bloqueado e qual trabalho foi afetado?" },
        reproduction: { label: "Etapas / evidências", placeholder: "Etapas, capturas de tela, links ou mensagens de erro" },
        resolution: { label: "Notas da resolução", placeholder: "Correção aplicada, alternativa ou próxima escalação" },
      },
      checklist: ["Classificar gravidade", "Confirmar solicitante e cliente afetado", "Coletar evidências", "Definir responsável", "Comunicar status", "Resolver ou escalar", "Confirmar com o solicitante"],
    },
    admin: {
      label: "Administrativo geral",
      description: "Operações internas, acessos, documentos, fornecedores e aprovações.",
      fields: {
        request_type: { label: "Tipo de solicitação", placeholder: "Acesso, documento, RH, fornecedor ou operação" },
        requester: { label: "Solicitante", placeholder: "Pessoa ou departamento solicitante" },
        department: { label: "Departamento", placeholder: "Comercial, financeiro, criativo ou operações" },
        approval_needed: { label: "Aprovação necessária", placeholder: "Aprovador e condição para aprovação" },
        required_file: { label: "Documento/arquivo necessário", placeholder: "Contrato, acesso, recibo, briefing ou documento de identidade" },
        vendor: { label: "Fornecedor", placeholder: "Prestador externo, se aplicável" },
      },
      checklist: ["Solicitante confirmado", "Arquivo necessário anexado", "Aprovador definido", "Ação concluída", "Solicitante notificado"],
    },
  },
};

export function taskTemplateTranslationEntries(
  language: TaskTemplateLanguage,
): Record<string, string> {
  const entries: Record<string, string> = { ...BRIEF_COPY[language] };

  for (const [templateId, template] of Object.entries(TASK_TEMPLATE_COPY[language])) {
    entries[`taskTemplate.${templateId}.label`] = template.label;
    entries[`taskTemplate.${templateId}.description`] = template.description;

    for (const [fieldKey, field] of Object.entries(template.fields)) {
      entries[`taskTemplate.${templateId}.field.${fieldKey}.label`] = field.label;
      entries[`taskTemplate.${templateId}.field.${fieldKey}.placeholder`] = field.placeholder;
    }

    template.checklist.forEach((item, index) => {
      entries[`taskTemplate.${templateId}.checklist.${index}`] = item;
    });
  }

  return entries;
}
