import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isSuperAdmin } from "@/lib/auth-helpers";
import { withErrorReporting } from "@/lib/with-error-reporting";

const RESET_CONFIRMATION = "RESET WORKSPACE DATA";

function canResetWorkspaceData(name: string) {
  return /\b(qa|test|testing|sandbox|e2e|personal)\b/i.test(name);
}

async function POST_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const body = (await req.json().catch(() => ({}))) as { confirmation?: string };

  if (body.confirmation !== RESET_CONFIRMATION) {
    return NextResponse.json(
      { error: `Type ${RESET_CONFIRMATION} to reset this QA workspace.` },
      { status: 400 },
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canResetWorkspaceData(workspace.name)) {
    return NextResponse.json(
      {
        error:
          "Workspace reset is limited to dedicated QA, test, sandbox, E2E, or personal workspaces.",
      },
      { status: 400 },
    );
  }

  if (!isSuperAdmin(auth)) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspace_id_user_id: {
          workspace_id: workspace.id,
          user_id: auth.prismaUser.id,
        },
      },
      select: { role: true, status: true },
    });
    if (membership?.role !== "owner" || membership.status !== "active") {
      return NextResponse.json(
        { error: "Only workspace owners can reset workspace data." },
        { status: 403 },
      );
    }
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const counts = {
      departments: await tx.department.count({ where: { workspace_id: workspace.id } }),
      spaces: await tx.space.count({ where: { workspace_id: workspace.id } }),
      folders: await tx.folder.count({ where: { workspace_id: workspace.id } }),
      projects: await tx.project.count({ where: { workspace_id: workspace.id } }),
      tasks: await tx.task.count({ where: { project: { workspace_id: workspace.id } } }),
      docs: await tx.doc.count({ where: { workspace_id: workspace.id } }),
      clients: await tx.company.count({ where: { workspace_id: workspace.id } }),
      contacts: await tx.companyContact.count({ where: { workspace_id: workspace.id } }),
      notes: await tx.companyNote.count({ where: { workspace_id: workspace.id } }),
      calendar_events: await tx.calendarEvent.count({ where: { workspace_id: workspace.id } }),
      time_entries: await tx.timeEntry.count({ where: { workspace_id: workspace.id } }),
      notifications: await tx.notification.count({ where: { workspace_id: workspace.id } }),
      activity_events: await tx.activityEvent.count({ where: { workspace_id: workspace.id } }),
      templates: await tx.template.count({ where: { workspace_id: workspace.id } }),
      recurring_task_rules: await tx.recurringTaskRule.count({ where: { workspace_id: workspace.id } }),
      saved_views: await tx.savedView.count({ where: { workspace_id: workspace.id } }),
      goals: await tx.goal.count({ where: { workspace_id: workspace.id } }),
      workflow_statuses: await tx.workflowStatus.count({ where: { workspace_id: workspace.id } }),
      approval_requests: await tx.approvalRequest.count({ where: { workspace_id: workspace.id } }),
      approval_events: await tx.approvalEvent.count({ where: { workspace_id: workspace.id } }),
      automation_rules: await tx.automationRule.count({ where: { workspace_id: workspace.id } }),
      automation_runs: await tx.automationRun.count({ where: { workspace_id: workspace.id } }),
      client_reports: await tx.clientReport.count({ where: { workspace_id: workspace.id } }),
    };

    await tx.approvalEvent.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.approvalRequest.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.automationRun.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.automationRule.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.clientReport.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.notification.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.timeEntry.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.calendarEvent.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.activityEvent.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.savedView.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.goal.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.workflowStatus.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.recurringTaskRule.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.template.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.doc.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.taskDependency.deleteMany({
      where: {
        OR: [
          { task: { project: { workspace_id: workspace.id } } },
          { depends_on: { project: { workspace_id: workspace.id } } },
        ],
      },
    });
    await tx.task.deleteMany({ where: { project: { workspace_id: workspace.id } } });
    await tx.project.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.company.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.folder.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.space.deleteMany({ where: { workspace_id: workspace.id } });
    await tx.department.deleteMany({ where: { workspace_id: workspace.id } });

    await tx.activityEvent.create({
      data: {
        workspace_id: workspace.id,
        actor_id: auth.prismaUser.id,
        type: "workspace_test_data_reset",
        entity_type: "workspace",
        entity_id: workspace.id,
        metadata: {
          workspace_name: workspace.name,
          confirmation: RESET_CONFIRMATION,
          deleted: counts,
        },
      },
    });

    return counts;
  });

  return NextResponse.json({
    success: true,
    workspace_id: workspace.id,
    workspace_name: workspace.name,
    deleted,
  });
}

export const POST = withErrorReporting(
  "api:workspaces/id/reset-test-data:POST",
  POST_handler,
);
