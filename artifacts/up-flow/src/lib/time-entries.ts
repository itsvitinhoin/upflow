import { prisma } from "@/lib/prisma";

export async function validateProjectTask(input: {
  workspaceId: string;
  projectId?: string | null;
  taskId?: string | null;
}) {
  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, workspace_id: input.workspaceId },
      select: { id: true },
    });
    if (!project) return "Project not found";
  }
  if (input.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: input.taskId, project: { workspace_id: input.workspaceId } },
      select: { id: true, project_id: true },
    });
    if (!task) return "Task not found";
    if (input.projectId && task.project_id !== input.projectId) {
      return "Task does not belong to selected project";
    }
  }
  return null;
}
