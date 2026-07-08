import type { Task } from "@/lib/types";

export type WorkflowFormKind = "marketing_b2b" | "marketing_b2c" | "finance" | "support";

export type OnboardingTaskAction =
  | { kind: "form"; href: string; formKind: WorkflowFormKind }
  | { kind: "calendar"; href: string };

function taskSearchText(task: Task) {
  return [
    task.title,
    task.description,
    task.project?.name,
    task.onboarding_link?.department,
    task.onboarding_link?.title,
    task.onboarding_link?.company_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isFinanceOnboardingTask(task: Task) {
  const text = taskSearchText(task);
  return (
    text.includes("finance") ||
    text.includes("financial") ||
    text.includes("cadastro financeiro") ||
    text.includes("billing") ||
    text.includes("faturamento") ||
    text.includes("company registration") ||
    text.includes("contract") ||
    text.includes("contrato")
  );
}

function isSchedulingOnboardingTask(task: Task) {
  const text = taskSearchText(task);
  return (
    text.includes("schedule") ||
    text.includes("scheduled") ||
    text.includes("meeting") ||
    text.includes("kickoff") ||
    text.includes("reuni") ||
    text.includes("visita") ||
    text.includes("agenda")
  );
}

function isSupportGroupOnboardingTask(task: Task) {
  const text = taskSearchText(task);
  const hasGroupSignal =
    text.includes("client channels") ||
    text.includes("client communication") ||
    text.includes("communication group") ||
    text.includes("support group") ||
    text.includes("whatsapp") ||
    text.includes("grupo");
  return Boolean(
    hasGroupSignal ||
      (text.includes("technical support") &&
        text.includes("onboarding") &&
        !isSchedulingOnboardingTask(task)),
  );
}

function isMarketingB2BFormTask(task: Task) {
  const text = taskSearchText(task);
  return (
    text.includes("marketing b2b") &&
    (text.includes("form") || text.includes("formulario") || text.includes("formulário")) &&
    !isSchedulingOnboardingTask(task)
  );
}

export function workflowFormKind(task: Task): WorkflowFormKind | null {
  if (task.marketing_b2b_onboarding_form) return "marketing_b2b";
  if (isMarketingB2BFormTask(task)) return "marketing_b2b";
  if (task.marketing_b2c_onboarding_form) return "marketing_b2c";
  if (isFinanceOnboardingTask(task)) return "finance";
  if (isSupportGroupOnboardingTask(task)) return "support";
  return null;
}

function workflowFormHref(task: Task, fallbackProjectId?: string | null) {
  const projectId = task.project_id ?? fallbackProjectId;
  return projectId ? `/projects/${projectId}?view=form&task=${task.id}` : null;
}

function meetingKind(task: Task) {
  const department = task.onboarding_link?.department?.trim();
  const normalized = department?.toLowerCase() ?? "";
  if (normalized.includes("marketing b2b")) return "Marketing B2B onboarding meeting";
  if (normalized.includes("marketing b2c")) return "Marketing B2C onboarding meeting";
  if (department) return `${department} onboarding meeting`;
  return "Onboarding meeting";
}

function meetingTitle(task: Task) {
  const company = task.onboarding_link?.company_name?.trim();
  const kind = meetingKind(task);
  if (company) return `${company} - ${kind}`;
  return task.title.replace(/^Onboarding:\s*/i, "");
}

function meetingDescription(task: Task) {
  const company = task.onboarding_link?.company_name?.trim();
  const department = task.onboarding_link?.department?.trim();
  const responsible = [task.assignee?.name, task.assignee?.email]
    .filter(Boolean)
    .join(" ");
  return [
    company ? `Client: ${company}` : null,
    department ? `Department: ${department}` : null,
    `Meeting type: ${meetingKind(task)}`,
    responsible ? `Responsible: ${responsible}` : null,
    "Agenda: align goals, accesses, communication rhythm, blockers, and next steps.",
    task.description ? `Task notes: ${task.description}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function calendarHrefForTask(task: Task, fallbackProjectId?: string | null) {
  const params = new URLSearchParams({
    create: "meeting",
    task: task.id,
    title: meetingTitle(task),
  });
  const projectId = task.project_id ?? fallbackProjectId;
  if (projectId) params.set("project", projectId);
  params.set("description", meetingDescription(task));
  if (task.assignee_id) params.set("attendees", task.assignee_id);
  return `/calendar?${params.toString()}`;
}

export function getOnboardingTaskAction(
  task: Task,
  fallbackProjectId?: string | null,
): OnboardingTaskAction | null {
  const formKind = workflowFormKind(task);
  if (formKind) {
    const href = workflowFormHref(task, fallbackProjectId);
    return href ? { kind: "form", href, formKind } : null;
  }
  if (isSchedulingOnboardingTask(task)) {
    return { kind: "calendar", href: calendarHrefForTask(task, fallbackProjectId) };
  }
  return null;
}
