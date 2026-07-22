import type { Prisma } from "@prisma/client";
import { deleteTasksByIds } from "@/lib/task-delete";

type Tx = Prisma.TransactionClient;

export interface ProjectDeleteTarget {
  id: string;
  workspace_id: string;
}
/**
 * Finds an in-progress onboarding that still depends on one of these projects.
 * Completed onboarding history can be retained after its source project is removed.
 */
export async function findActiveOnboardingProject(
  tx: Tx,
  projects: ProjectDeleteTarget[],
) {
  const projectIds = Array.from(
    new Set(projects.map((project) => project.id).filter(Boolean)),
  );
  if (!projectIds.length) return null;

  return tx.clientOnboarding.findFirst({
    where: {
      project_id: { in: projectIds },
      status: { not: "onboarding_complete" },
    },
    select: { id: true, project_id: true },
  });
}

export interface DeletedProjectCounts {
  approval_events: number;
  approval_requests: number;
  notifications: number;
  time_entries: number;
  calendar_events: number;
  recurring_rules: number;
  onboarding_task_links: number;
  client_onboardings: number;
  client_contracts: number;
  task_dependencies: number;
  comments: number;
  custom_field_values: number;
  custom_fields: number;
  workflow_statuses: number;
  project_members: number;
  docs: number;
  activity_events: number;
  tasks: number;
  projects: number;
}

export async function deleteProjectsByIds(
  tx: Tx,
  projects: ProjectDeleteTarget[],
): Promise<DeletedProjectCounts> {
  const projectIds = Array.from(new Set(projects.map((project) => project.id).filter(Boolean)));
  const workspaceIds = Array.from(new Set(projects.map((project) => project.workspace_id).filter(Boolean)));
  const empty: DeletedProjectCounts = {
    approval_events: 0,
    approval_requests: 0,
    notifications: 0,
    time_entries: 0,
    calendar_events: 0,
    recurring_rules: 0,
    onboarding_task_links: 0,
    client_onboardings: 0,
    client_contracts: 0,
    task_dependencies: 0,
    comments: 0,
    custom_field_values: 0,
    custom_fields: 0,
    workflow_statuses: 0,
    project_members: 0,
    docs: 0,
    activity_events: 0,
    tasks: 0,
    projects: 0,
  };
  if (projectIds.length === 0) return empty;

  const [tasks, docs] = await Promise.all([
    tx.task.findMany({
      where: { project_id: { in: projectIds } },
      select: { id: true },
    }),
    tx.doc.findMany({
      where: { project_id: { in: projectIds } },
      select: { id: true },
    }),
  ]);
  const taskIds = tasks.map((task) => task.id);
  const docIds = docs.map((doc) => doc.id);
  const approvalEntityIds = [...projectIds, ...taskIds, ...docIds];

  const approvalRequests = await tx.approvalRequest.findMany({
    where: {
      workspace_id: { in: workspaceIds },
      entity_id: { in: approvalEntityIds },
      entity_type: { in: ["project", "task", "doc", "report", "campaign", "deliverable"] },
    },
    select: { id: true },
  });
  const approvalIds = approvalRequests.map((approval) => approval.id);

  const activityWhere: Prisma.ActivityEventWhereInput = {
    workspace_id: { in: workspaceIds },
    OR: [
      { project_id: { in: projectIds } },
      { entity_type: "project", entity_id: { in: projectIds } },
      ...(taskIds.length ? [{ task_id: { in: taskIds } }] : []),
      ...(taskIds.length ? [{ entity_type: "task", entity_id: { in: taskIds } }] : []),
      ...(docIds.length ? [{ entity_type: "doc", entity_id: { in: docIds } }] : []),
    ],
  };

  const taskDeleted = await deleteTasksByIds(tx, taskIds, {
    deleteApprovalRequests: false,
    workspaceIds,
  });

  return {
    approval_events: approvalIds.length
      ? (await tx.approvalEvent.deleteMany({
          where: { approval_id: { in: approvalIds } },
        })).count
      : 0,
    approval_requests: approvalIds.length
      ? (await tx.approvalRequest.deleteMany({
          where: { id: { in: approvalIds } },
        })).count
      : 0,
    notifications: taskDeleted.notifications,
    time_entries:
      taskDeleted.time_entries +
      (await tx.timeEntry.deleteMany({
        where: { project_id: { in: projectIds } },
      })).count,
    calendar_events:
      taskDeleted.calendar_events +
      (await tx.calendarEvent.deleteMany({
        where: { project_id: { in: projectIds } },
      })).count,
    recurring_rules:
      taskDeleted.recurring_rules +
      (await tx.recurringTaskRule.deleteMany({
        where: { project_id: { in: projectIds } },
      })).count,
    onboarding_task_links: taskDeleted.onboarding_task_links,
    client_onboardings: (await tx.clientOnboarding.updateMany({
      where: { project_id: { in: projectIds } },
      data: { project_id: null },
    })).count,
    client_contracts: (await tx.clientContract.updateMany({
      where: { project_id: { in: projectIds } },
      data: { project_id: null },
    })).count,
    task_dependencies: taskDeleted.task_dependencies,
    comments: taskDeleted.comments,
    custom_field_values: taskDeleted.custom_field_values,
    custom_fields: (await tx.customFieldDefinition.deleteMany({
      where: { project_id: { in: projectIds } },
    })).count,
    workflow_statuses: (await tx.workflowStatus.deleteMany({
      where: { project_id: { in: projectIds } },
    })).count,
    project_members: (await tx.projectMember.deleteMany({
      where: { project_id: { in: projectIds } },
    })).count,
    docs: (await tx.doc.deleteMany({
      where: { project_id: { in: projectIds } },
    })).count,
    activity_events: (await tx.activityEvent.deleteMany({ where: activityWhere })).count,
    tasks: taskDeleted.tasks,
    projects: (await tx.project.deleteMany({
      where: { id: { in: projectIds } },
    })).count,
  };
}
