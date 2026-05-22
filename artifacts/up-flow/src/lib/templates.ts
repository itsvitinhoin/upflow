export type BuiltInTemplate = {
  id: string;
  name: string;
  type: string;
  description: string;
  config: {
    projectName: string;
    tasks: Array<{ title: string; priority?: "low" | "medium" | "high" }>;
  };
};

export const builtInTemplates: BuiltInTemplate[] = [
  {
    id: "client-onboarding",
    name: "Client onboarding",
    type: "client_onboarding",
    description: "Access, briefing, dashboards, tracking, and kickoff setup.",
    config: {
      projectName: "Client onboarding",
      tasks: [
        { title: "Collect accesses", priority: "high" },
        { title: "Run briefing", priority: "high" },
        { title: "Configure dashboard", priority: "medium" },
        { title: "Validate Meta and GA4 tracking", priority: "medium" },
      ],
    },
  },
  {
    id: "commercial-pipeline",
    name: "Commercial pipeline",
    type: "commercial_pipeline",
    description: "Lead qualification, proposal, follow-up, and closing.",
    config: {
      projectName: "Commercial pipeline",
      tasks: [
        { title: "Qualify lead", priority: "high" },
        { title: "Prepare proposal", priority: "high" },
        { title: "Schedule follow-up", priority: "medium" },
        { title: "Close deal and hand off", priority: "medium" },
      ],
    },
  },
  {
    id: "campaign-launch",
    name: "Campaign launch",
    type: "campaign_launch",
    description: "Briefing, creatives, copy, traffic setup, approval, and launch.",
    config: {
      projectName: "Campaign launch",
      tasks: [
        { title: "Approve campaign briefing", priority: "high" },
        { title: "Produce creatives", priority: "high" },
        { title: "Write campaign copy", priority: "medium" },
        { title: "Configure traffic setup", priority: "high" },
        { title: "Final approval and launch", priority: "high" },
      ],
    },
  },
  {
    id: "weekly-report",
    name: "Weekly report",
    type: "weekly_report",
    description: "Data pull, analysis, message draft, and review.",
    config: {
      projectName: "Weekly report",
      tasks: [
        { title: "Pull weekly data", priority: "medium" },
        { title: "Analyze results", priority: "high" },
        { title: "Draft client message", priority: "medium" },
        { title: "Internal review", priority: "medium" },
      ],
    },
  },
  {
    id: "content-production",
    name: "Content production",
    type: "content_production",
    description: "Script, recording, editing, approval, and posting.",
    config: {
      projectName: "Content production",
      tasks: [
        { title: "Write script", priority: "medium" },
        { title: "Record content", priority: "medium" },
        { title: "Edit content", priority: "high" },
        { title: "Approval", priority: "high" },
        { title: "Publish", priority: "medium" },
      ],
    },
  },
  {
    id: "finance-routine",
    name: "Finance routine",
    type: "finance_routine",
    description: "Invoices, commissions, payments, and cashflow checks.",
    config: {
      projectName: "Finance routine",
      tasks: [
        { title: "Issue invoices", priority: "high" },
        { title: "Review commissions", priority: "medium" },
        { title: "Confirm payments", priority: "high" },
        { title: "Update cashflow", priority: "medium" },
      ],
    },
  },
];
