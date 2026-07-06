import { prisma } from "@/lib/prisma";
import type { TaskOnboardingLink } from "@/lib/types";

export async function loadTaskOnboardingLinkMap(taskIds: string[]) {
  const uniqueTaskIds = Array.from(new Set(taskIds.filter(Boolean)));
  const byTaskId = new Map<string, TaskOnboardingLink>();
  if (uniqueTaskIds.length === 0) return byTaskId;

  const links = await prisma.onboardingChecklistItem.findMany({
    where: { task_id: { in: uniqueTaskIds } },
    select: {
      id: true,
      task_id: true,
      onboarding_id: true,
      department: true,
      title: true,
      status: true,
      onboarding: {
        select: {
          company_id: true,
          progress: true,
          company: { select: { name: true } },
        },
      },
    },
  });

  for (const link of links) {
    if (!link.task_id) continue;
    byTaskId.set(link.task_id, {
      id: link.id,
      onboarding_id: link.onboarding_id,
      company_id: link.onboarding.company_id,
      company_name: link.onboarding.company.name,
      department: link.department,
      title: link.title,
      status: link.status,
      progress: link.onboarding.progress,
      href: `/clients/${link.onboarding.company_id}`,
    });
  }

  return byTaskId;
}

export function attachTaskOnboardingLink<T extends { id: string }>(
  task: T,
  onboardingLinkByTaskId: Map<string, TaskOnboardingLink>,
) {
  return { ...task, onboarding_link: onboardingLinkByTaskId.get(task.id) ?? null };
}
