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
  if (isWorkspaceAdminFor(auth, workspaceId)) {
    return { workspace_id: workspaceId };
  }

  return {
    workspace_id: workspaceId,
    OR: [
      { owner_id: auth.prismaUser.id },
      { project_members: { none: {} } },
      { project_members: { some: { user_id: auth.prismaUser.id } } },
    ],
  };
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
  if (!canAccessWorkspace(auth, project.workspace_id)) return false;
  if (isWorkspaceAdminFor(auth, project.workspace_id)) return true;
  if (project.owner_id === auth.prismaUser.id) return true;
  if (await isProjectMember(project.id, auth.prismaUser.id)) return true;
  return !(await hasExplicitMembers(project.id));
}

export async function canContributeToProject(
  auth: AuthUser,
  project: ProjectAccessTarget,
): Promise<boolean> {
  if (!canAccessWorkspace(auth, project.workspace_id)) return false;
  if (isWorkspaceAdminFor(auth, project.workspace_id)) return true;
  if (project.owner_id === auth.prismaUser.id) return true;
  if (await isProjectMember(project.id, auth.prismaUser.id)) return true;
  return !(await hasExplicitMembers(project.id));
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
    },
    select: { id: true },
  });
  if (!activeWorkspaceMember) return false;
  if (!(await hasExplicitMembers(project.id))) return true;
  return project.owner_id === userId || (await isProjectMember(project.id, userId));
}
