import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const CreateDependencySchema = z.object({
  depends_on_id: z.string().uuid(),
});

const taskSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  due_date: true,
  project_id: true,
  assignee_id: true,
  project: {
    select: {
      id: true,
      name: true,
      workspace_id: true,
      owner_id: true,
    },
  },
} as const;

async function createsCycle(taskId: string, dependsOnId: string, workspaceId: string) {
  const visited = new Set<string>();
  let frontier = [dependsOnId];

  while (frontier.length > 0) {
    if (frontier.includes(taskId)) return true;

    const unseen = frontier.filter((id) => !visited.has(id));
    if (unseen.length === 0) return false;
    unseen.forEach((id) => visited.add(id));

    const links = await prisma.taskDependency.findMany({
      where: {
        task_id: { in: unseen },
        task: { project: { workspace_id: workspaceId } },
      },
      select: { depends_on_id: true },
    });
    frontier = links.map((link) => link.depends_on_id);
  }

  return false;
}

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: taskSelect,
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, task.project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [dependencies, blocking] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { task_id: task.id },
      orderBy: { created_at: "asc" },
      include: {
        depends_on: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            due_date: true,
            project: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.taskDependency.findMany({
      where: { depends_on_id: task.id },
      orderBy: { created_at: "asc" },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            due_date: true,
            project: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({ task, dependencies, blocking });
}

async function POST_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const parsed = CreateDependencySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid dependency", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [task, dependsOnTask] = await Promise.all([
    prisma.task.findUnique({ where: { id: params.id }, select: taskSelect }),
    prisma.task.findUnique({ where: { id: parsed.data.depends_on_id }, select: taskSelect }),
  ]);
  if (!task || !dependsOnTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!canAccessWorkspace(auth, task.project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (task.project.workspace_id !== dependsOnTask.project.workspace_id) {
    return NextResponse.json(
      { error: "Dependencies must stay inside the same workspace" },
      { status: 400 },
    );
  }
  const canManage =
    task.assignee_id === auth.prismaUser.id ||
    task.project.owner_id === auth.prismaUser.id ||
    isWorkspaceAdminFor(auth, task.project.workspace_id);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (task.id === dependsOnTask.id) {
    return NextResponse.json(
      { error: "A task cannot depend on itself" },
      { status: 400 },
    );
  }

  const cycle = await createsCycle(task.id, dependsOnTask.id, task.project.workspace_id);
  if (cycle) {
    return NextResponse.json(
      { error: "This dependency would create a cycle" },
      { status: 409 },
    );
  }

  const dependency = await prisma.taskDependency.upsert({
    where: {
      task_id_depends_on_id: {
        task_id: task.id,
        depends_on_id: dependsOnTask.id,
      },
    },
    update: {},
    create: {
      task_id: task.id,
      depends_on_id: dependsOnTask.id,
    },
    include: {
      depends_on: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          due_date: true,
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  await recordActivity({
    workspace_id: task.project.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "task_dependency_added",
    entity_type: "task_dependency",
    entity_id: dependency.id,
    project_id: task.project_id,
    task_id: task.id,
    metadata: {
      task_title: task.title,
      depends_on_id: dependsOnTask.id,
      depends_on_title: dependsOnTask.title,
    },
  });

  return NextResponse.json(dependency, { status: 201 });
}

export const GET = withErrorReporting("api:tasks/id/dependencies:GET", GET_handler);
export const POST = withErrorReporting("api:tasks/id/dependencies:POST", POST_handler);
