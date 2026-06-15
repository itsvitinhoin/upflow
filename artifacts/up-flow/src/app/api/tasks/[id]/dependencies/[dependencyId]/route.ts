import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string; dependencyId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const dependency = await prisma.taskDependency.findFirst({
    where: { id: params.dependencyId, task_id: params.id },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          project_id: true,
          assignee_id: true,
          project: { select: { workspace_id: true, owner_id: true } },
        },
      },
      depends_on: { select: { id: true, title: true } },
    },
  });
  if (!dependency) {
    return NextResponse.json({ error: "Dependency not found" }, { status: 404 });
  }
  const workspaceId = dependency.task.project.workspace_id;
  if (!canAccessWorkspace(auth, workspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const canManage =
    dependency.task.assignee_id === auth.prismaUser.id ||
    dependency.task.project.owner_id === auth.prismaUser.id ||
    isWorkspaceAdminFor(auth, workspaceId);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.taskDependency.delete({ where: { id: dependency.id } });
  await recordActivity({
    workspace_id: workspaceId,
    actor_id: auth.prismaUser.id,
    type: "task_dependency_removed",
    entity_type: "task_dependency",
    entity_id: dependency.id,
    project_id: dependency.task.project_id,
    task_id: dependency.task.id,
    metadata: {
      task_title: dependency.task.title,
      depends_on_id: dependency.depends_on.id,
      depends_on_title: dependency.depends_on.title,
    },
  });

  return NextResponse.json({ success: true });
}

export const DELETE = withErrorReporting(
  "api:tasks/id/dependencies/dependencyId:DELETE",
  DELETE_handler,
);
