import { prisma } from "@/lib/prisma";

export const TESTER_WORKSPACE_NAME = "UP Flow Test Workspace";
export const TESTER_WORKSPACE_SLUG = "up-flow-test-workspace";

export async function ensureTesterWorkspace(ownerId: string) {
  const workspace = await prisma.workspace.upsert({
    where: { slug: TESTER_WORKSPACE_SLUG },
    create: {
      name: TESTER_WORKSPACE_NAME,
      slug: TESTER_WORKSPACE_SLUG,
      members: { create: { user_id: ownerId, role: "owner" } },
    },
    update: {},
    select: { id: true, name: true, slug: true },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspace_id_user_id: {
        workspace_id: workspace.id,
        user_id: ownerId,
      },
    },
    create: { workspace_id: workspace.id, user_id: ownerId, role: "owner" },
    update: { role: "owner", status: "active" },
  });

  await seedTesterWorkspace(workspace.id, ownerId);

  return workspace;
}

async function seedTesterWorkspace(workspaceId: string, ownerId: string) {
  const existingSpace = await prisma.space.findFirst({
    where: { workspace_id: workspaceId },
    select: { id: true },
  });
  if (existingSpace) return;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  const meetingStart = new Date(now);
  meetingStart.setHours(10, 0, 0, 0);
  const meetingEnd = new Date(meetingStart);
  meetingEnd.setMinutes(meetingStart.getMinutes() + 30);

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        workspace_id: workspaceId,
        name: "Demo Client",
        status: "active",
        commercial_status: "onboarding",
        industry: "Agency Operations",
        service_type: "Full-service marketing",
        plan_name: "Growth Plan",
        billing_cycle: "monthly",
        contract_value: 4500,
        commission: 10,
        included_services: [
          "Project management",
          "Campaign planning",
          "Weekly reporting",
        ],
        owner_id: ownerId,
      },
    });

    await tx.companyContact.create({
      data: {
        workspace_id: workspaceId,
        company_id: company.id,
        name: "Demo Client Contact",
        email: "client@example.com",
        role: "Marketing lead",
      },
    });

    const space = await tx.space.create({
      data: {
        workspace_id: workspaceId,
        owner_id: ownerId,
        name: "Client Operations",
        icon: "rocket",
        position: 1,
      },
    });

    const folder = await tx.folder.create({
      data: {
        workspace_id: workspaceId,
        owner_id: ownerId,
        space_id: space.id,
        name: "Demo Client",
        icon: "folder",
        position: 1,
      },
    });

    const project = await tx.project.create({
      data: {
        workspace_id: workspaceId,
        owner_id: ownerId,
        space_id: space.id,
        folder_id: folder.id,
        company_id: company.id,
        name: "Client onboarding",
        description: "Representative project for invited testers.",
        kind: "client",
        due_date: nextWeek,
      },
    });

    const task = await tx.task.create({
      data: {
        project_id: project.id,
        company_id: company.id,
        title: "Review onboarding checklist",
        description: "Explore task details, comments, due dates, and status changes.",
        status: "todo",
        priority: "high",
        assignee_id: ownerId,
        due_date: tomorrow,
        position: 1,
      },
    });

    await tx.task.create({
      data: {
        project_id: project.id,
        company_id: company.id,
        title: "Prepare first weekly report",
        status: "in_progress",
        priority: "medium",
        assignee_id: ownerId,
        due_date: nextWeek,
        position: 2,
      },
    });

    await tx.calendarEvent.create({
      data: {
        workspace_id: workspaceId,
        created_by: ownerId,
        project_id: project.id,
        task_id: task.id,
        company_id: company.id,
        title: "Demo client kickoff",
        description: "Sample meeting linked to a client, project, and task.",
        type: "meeting",
        starts_at: meetingStart,
        ends_at: meetingEnd,
        timezone: "America/Sao_Paulo",
      },
    });

    await tx.doc.create({
      data: {
        workspace_id: workspaceId,
        project_id: project.id,
        author_id: ownerId,
        title: "Tester notes",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Use this workspace to test UP Flow without touching real client data.",
                },
              ],
            },
          ],
        },
      },
    });

    await tx.activityEvent.create({
      data: {
        workspace_id: workspaceId,
        actor_id: ownerId,
        project_id: project.id,
        task_id: task.id,
        company_id: company.id,
        type: "tester_workspace_seeded",
        entity_type: "workspace",
        entity_id: workspaceId,
        metadata: { workspace: TESTER_WORKSPACE_NAME },
      },
    });
  });
}
