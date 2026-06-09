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
    name: "New Client Onboarding",
    type: "client_onboarding",
    description: "Access, briefing, tracking, kickoff, service plan, and first delivery setup.",
    config: {
      projectName: "New Client Onboarding",
      tasks: [
        { title: "Confirm service plan and success goals", priority: "high" },
        { title: "Collect platform accesses and brand assets", priority: "high" },
        { title: "Run client briefing and map approval owners", priority: "high" },
        { title: "Configure tracking dashboard and reporting cadence", priority: "medium" },
        { title: "Validate Meta, Google, website, and analytics access", priority: "medium" },
        { title: "Schedule kickoff and first delivery checkpoint", priority: "medium" },
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
    name: "Campaign Launch",
    type: "campaign_launch",
    description: "General campaign launch flow for brief, creative, copy, setup, approval, and launch.",
    config: {
      projectName: "Campaign Launch",
      tasks: [
        { title: "Approve campaign briefing and success metric", priority: "high" },
        { title: "Produce creative assets and copy variants", priority: "high" },
        { title: "Configure channel setup and tracking", priority: "high" },
        { title: "Run internal QA and client approval", priority: "high" },
        { title: "Launch campaign and schedule performance check", priority: "medium" },
      ],
    },
  },
  {
    id: "meta-ads-campaign-launch",
    name: "Meta Ads Campaign Launch",
    type: "paid_media_launch",
    description: "Offer, audience, creative, copy, tracking, approval, launch, and first optimization.",
    config: {
      projectName: "Meta Ads Campaign Launch",
      tasks: [
        { title: "Approve campaign objective, offer, and KPI", priority: "high" },
        { title: "Confirm pixel, events, UTMs, and conversion setup", priority: "high" },
        { title: "Produce static, story, reel, and carousel creatives", priority: "high" },
        { title: "Write primary text, headlines, and CTA variations", priority: "medium" },
        { title: "Build audiences, placements, budget, and campaign structure", priority: "high" },
        { title: "Send campaign for internal and client approval", priority: "high" },
        { title: "Launch and schedule 48-hour performance check", priority: "medium" },
      ],
    },
  },
  {
    id: "google-ads-campaign-launch",
    name: "Google Ads Campaign Launch",
    type: "paid_media_launch",
    description: "Keywords, landing page, conversion tracking, copy, launch, and search terms review.",
    config: {
      projectName: "Google Ads Campaign Launch",
      tasks: [
        { title: "Confirm objective, offer, locations, and budget", priority: "high" },
        { title: "Validate conversion tracking, GA4, GTM, and landing page", priority: "high" },
        { title: "Build keyword set, negatives, and campaign structure", priority: "high" },
        { title: "Write search ad copy and extensions", priority: "medium" },
        { title: "Review quality score risks and landing page alignment", priority: "medium" },
        { title: "Launch campaign and schedule first search terms review", priority: "medium" },
      ],
    },
  },
  {
    id: "social-monthly-content-plan",
    name: "Social Media Monthly Content Plan",
    type: "content_calendar",
    description: "Monthly themes, captions, creative queue, approvals, scheduling, and publishing.",
    config: {
      projectName: "Social Media Monthly Content Plan",
      tasks: [
        { title: "Confirm monthly content themes and campaign moments", priority: "high" },
        { title: "Build content calendar with formats and channels", priority: "high" },
        { title: "Write captions, hooks, and CTA notes", priority: "medium" },
        { title: "Create design and video production queue", priority: "high" },
        { title: "Send monthly content for approval", priority: "high" },
        { title: "Schedule approved posts and monitor publishing", priority: "medium" },
      ],
    },
  },
  {
    id: "creative-production-request",
    name: "Creative Production Request",
    type: "creative_production",
    description: "Briefing, asset specs, references, production, revision, approval, and handoff.",
    config: {
      projectName: "Creative Production Request",
      tasks: [
        { title: "Complete creative brief with objective and audience", priority: "high" },
        { title: "Collect references, brand assets, and required formats", priority: "high" },
        { title: "Assign designer/editor and production deadline", priority: "medium" },
        { title: "Produce first creative draft", priority: "high" },
        { title: "Run internal review and revision pass", priority: "medium" },
        { title: "Send for approval and deliver final files", priority: "high" },
      ],
    },
  },
  {
    id: "landing-page-build",
    name: "Landing Page Build",
    type: "landing_page",
    description: "Brief, copy, design, development, tracking, QA, and launch.",
    config: {
      projectName: "Landing Page Build",
      tasks: [
        { title: "Confirm landing page goal, offer, and audience", priority: "high" },
        { title: "Draft page copy, sections, and form requirements", priority: "high" },
        { title: "Design landing page layout and mobile states", priority: "high" },
        { title: "Build page and connect forms/integrations", priority: "high" },
        { title: "Install tracking, pixels, events, and UTMs", priority: "medium" },
        { title: "QA desktop, mobile, speed, and conversion path", priority: "high" },
        { title: "Launch and monitor first traffic window", priority: "medium" },
      ],
    },
  },
  {
    id: "weekly-report",
    name: "Performance Report Delivery",
    type: "performance_report",
    description: "Data pull, insight analysis, client narrative, internal review, and delivery.",
    config: {
      projectName: "Performance Report Delivery",
      tasks: [
        { title: "Pull performance data from active channels", priority: "medium" },
        { title: "Identify wins, risks, blockers, and next actions", priority: "high" },
        { title: "Draft client-ready report narrative", priority: "medium" },
        { title: "Review numbers and recommendations internally", priority: "high" },
        { title: "Send report and log client follow-up actions", priority: "medium" },
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
    id: "website-maintenance-request",
    name: "Website Maintenance Request",
    type: "website_maintenance",
    description: "Bug, content update, access, QA, approval, and release tracking.",
    config: {
      projectName: "Website Maintenance Request",
      tasks: [
        { title: "Confirm request scope, affected pages, and priority", priority: "high" },
        { title: "Collect screenshots, links, copy, or access details", priority: "medium" },
        { title: "Apply website update or technical fix", priority: "high" },
        { title: "QA desktop, mobile, links, forms, and tracking", priority: "high" },
        { title: "Send for approval and publish", priority: "medium" },
      ],
    },
  },
  {
    id: "influencer-campaign",
    name: "Influencer Campaign",
    type: "influencer_campaign",
    description: "Creators, brief, contracts, content review, posting, and performance recap.",
    config: {
      projectName: "Influencer Campaign",
      tasks: [
        { title: "Define influencer profile, audience, and offer", priority: "high" },
        { title: "Shortlist creators and confirm availability", priority: "medium" },
        { title: "Prepare brief, deliverables, usage rights, and contract", priority: "high" },
        { title: "Review creator content and request revisions if needed", priority: "high" },
        { title: "Track posting deadlines and collect live links", priority: "medium" },
        { title: "Compile campaign performance and learnings", priority: "medium" },
      ],
    },
  },
  {
    id: "email-marketing-campaign",
    name: "Email Marketing Campaign",
    type: "email_marketing",
    description: "Audience, segmentation, copy, design, automation, QA, send, and performance review.",
    config: {
      projectName: "Email Marketing Campaign",
      tasks: [
        { title: "Confirm campaign goal, list, segment, and offer", priority: "high" },
        { title: "Write subject lines, preview text, and email copy", priority: "medium" },
        { title: "Design or assemble email layout", priority: "medium" },
        { title: "Configure links, tracking, automation, and send time", priority: "high" },
        { title: "QA rendering, mobile, links, and unsubscribe path", priority: "high" },
        { title: "Send campaign and review performance", priority: "medium" },
      ],
    },
  },
  {
    id: "client-monthly-review",
    name: "Client Monthly Review",
    type: "client_review",
    description: "Monthly performance, risks, next priorities, meeting prep, and follow-up tasks.",
    config: {
      projectName: "Client Monthly Review",
      tasks: [
        { title: "Review monthly KPIs, delivery status, and open risks", priority: "high" },
        { title: "Prepare client agenda and decisions needed", priority: "medium" },
        { title: "Summarize completed deliverables and next month priorities", priority: "medium" },
        { title: "Run client review meeting", priority: "high" },
        { title: "Create follow-up actions and update client notes", priority: "high" },
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
