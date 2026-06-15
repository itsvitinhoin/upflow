import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, isWorkspaceAdminFor, type AuthUser } from "@/lib/auth-helpers";
import { canContributeToProject, canReadProject } from "@/lib/project-access";

export async function requireCurrentWorkspace(auth: AuthUser) {
  if (!auth.currentWorkspaceId || !canAccessWorkspace(auth, auth.currentWorkspaceId)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "No active workspace" }, { status: 404 }),
    };
  }
  return { ok: true as const, workspaceId: auth.currentWorkspaceId };
}

export function requireWorkspaceAdmin(auth: AuthUser, workspaceId: string) {
  if (!isWorkspaceAdminFor(auth, workspaceId)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Workspace admin access required" }, { status: 403 }),
    };
  }
  return { ok: true as const };
}

export async function validateProjectScope(projectId: string, workspaceId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspace_id: workspaceId },
    select: { id: true, owner_id: true, company_id: true },
  });
  if (!project) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Project not found in this workspace" }, { status: 400 }),
    };
  }
  return { ok: true as const, project };
}

export async function validateReadableProjectScope(
  projectId: string,
  workspaceId: string,
  auth: AuthUser,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspace_id: workspaceId },
    select: { id: true, workspace_id: true, owner_id: true, company_id: true },
  });
  if (!project || !(await canReadProject(auth, project))) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Project not found in this workspace" }, { status: 404 }),
    };
  }
  return { ok: true as const, project };
}

export async function validateContributableProjectScope(
  projectId: string,
  workspaceId: string,
  auth: AuthUser,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspace_id: workspaceId },
    select: { id: true, workspace_id: true, owner_id: true, company_id: true },
  });
  if (!project) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Project not found in this workspace" }, { status: 404 }),
    };
  }
  if (!(await canContributeToProject(auth, project))) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Project access required" }, { status: 403 }),
    };
  }
  return { ok: true as const, project };
}

export async function validateTaskScope(taskId: string, workspaceId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { workspace_id: workspaceId } },
    select: { id: true, title: true, project_id: true, assignee_id: true },
  });
  if (!task) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Task not found in this workspace" }, { status: 400 }),
    };
  }
  return { ok: true as const, task };
}

export async function validateReadableTaskScope(
  taskId: string,
  workspaceId: string,
  auth: AuthUser,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { workspace_id: workspaceId } },
    select: {
      id: true,
      title: true,
      project_id: true,
      assignee_id: true,
      project: { select: { id: true, workspace_id: true, owner_id: true } },
    },
  });
  if (!task || !(await canReadProject(auth, task.project))) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Task not found in this workspace" }, { status: 404 }),
    };
  }
  return { ok: true as const, task };
}

export async function validateContributableTaskScope(
  taskId: string,
  workspaceId: string,
  auth: AuthUser,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { workspace_id: workspaceId } },
    select: {
      id: true,
      title: true,
      project_id: true,
      assignee_id: true,
      project: { select: { id: true, workspace_id: true, owner_id: true } },
    },
  });
  if (!task) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Task not found in this workspace" }, { status: 404 }),
    };
  }
  if (!(await canContributeToProject(auth, task.project))) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Project access required" }, { status: 403 }),
    };
  }
  return { ok: true as const, task };
}
