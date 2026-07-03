import type { Prisma } from "@prisma/client";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
  type AuthUser,
} from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

type ProjectAccessTarget = {
  id: string;
  workspace_id: string;
  owner_id?: string | null;
};

export function readableProjectWhere(
  auth: AuthUser,
  workspaceId: string,
): Prisma.ProjectWhereInput {
  if (!canAccessWorkspace(auth, workspaceId)) return { id: "__forbidden__" };
  return { workspace_id: workspaceId };
}

async function hasExplicitMembers(projectId: string): Promise<boolean> {
  const row = await prisma.projectMember.findFirst({
    where: { project_id: projectId },
    select: { id: true },
  });
  return Boolean(row);
}

async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const row = await prisma.projectMember.findUnique({
    where: { project_id_user_id: { project_id: projectId, user_id: userId } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function canReadProject(
  auth: AuthUser,
  project: ProjectAccessTarget,
): Promise<boolean> {
  return canAccessWorkspace(auth, project.workspace_id);
}

export async function canContributeToProject(
  auth: AuthUser,
  project: ProjectAccessTarget,
): Promise<boolean> {
  if (isWorkspaceAdminFor(auth, project.workspace_id)) return true;
  const userId = auth.prismaUser.id;
  const activeWorkspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspace_id: project.workspace_id,
      user_id: userId,
      status: "active",
      role: { not: "guest" },
    },
    select: { id: true },
  });
  if (!activeWorkspaceMember) return false;
  if (!(await hasExplicitMembers(project.id))) return true;
  return project.owner_id === userId || (await isProjectMember(project.id, userId));
}

export async function canAssignUserToProject(
  project: ProjectAccessTarget,
  userId: string,
): Promise<boolean> {
  const activeWorkspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspace_id: project.workspace_id,
      user_id: userId,
      status: "active",
      role: { not: "guest" },
    },
    select: { id: true },
  });
  if (!activeWorkspaceMember) return false;
  if (!(await hasExplicitMembers(project.id))) return true;
  return project.owner_id === userId || (await isProjectMember(project.id, userId));
}
