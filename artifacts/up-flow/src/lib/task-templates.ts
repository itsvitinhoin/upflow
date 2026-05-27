export type TaskTemplateId =
  | "general"
  | "creative"
  | "b2b_marketing"
  | "b2c_marketing"
  | "commercial"
  | "finance"
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

export function getTaskTemplate(id: string | undefined | null) {
  return TASK_TEMPLATES.find((template) => template.id === id) ?? TASK_TEMPLATES[0];
}

export function buildTaskBrief(input: {
  templateId: TaskTemplateId;
  values: Record<string, string>;
  notes?: string | null;
}) {
  const template = getTaskTemplate(input.templateId);
  const lines = [
    "## UP Flow Task Brief",
    `Type: ${template.label}`,
    "",
    "### Details",
  ];

  for (const field of template.fields) {
    const value = input.values[field.key]?.trim();
    if (value) lines.push(`- ${field.label}: ${value}`);
  }

  if (input.notes?.trim()) {
    lines.push("", "### Notes", input.notes.trim());
  }

  if (template.checklist.length > 0) {
    lines.push("", "### Suggested checklist");
    for (const item of template.checklist) lines.push(`- [ ] ${item}`);
  }

  return lines.join("\n").trim();
}

export function parseTaskBrief(description: string | null | undefined) {
  if (!description?.startsWith("## UP Flow Task Brief")) return null;
  const type = description.match(/^Type:\s*(.+)$/m)?.[1]?.trim() ?? "Structured task";
  const details = Array.from(description.matchAll(/^- ([^:]+):\s*(.+)$/gm)).map((match) => ({
    label: match[1],
    value: match[2],
  }));
  const checklist = Array.from(description.matchAll(/^- \[ \]\s*(.+)$/gm)).map((match) => match[1]);
  return { type, details, checklist };
}
