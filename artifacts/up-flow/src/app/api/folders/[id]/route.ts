import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { buildFolderTree, getDescendantFolderIds, wouldCreateFolderCycle } from "@/lib/folder-tree";
import { deleteProjectsByIds } from "@/lib/project-delete";
import { withErrorReporting } from "@/lib/with-error-reporting";

type FolderTreeNode = ReturnType<typeof buildFolderTree>[number];
type RouteContext = { params: Promise<{ id: string }> };

function findFolderNode(nodes: FolderTreeNode[], id: string): FolderTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findFolderNode(node.children, id);
    if (child) return child;
  }
  return null;
}

async function GET_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id } = await params;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const folder = await prisma.folder.findFirst({
    where: { id, workspace_id: auth.currentWorkspaceId },
    include: { space: true, parent: true },
  });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, folder.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const includeHiddenChildren = folder.sidebar_hidden;

  const [projects, allFolders] = await Promise.all([
    prisma.project.findMany({
      where: {
        folder_id: folder.id,
        workspace_id: folder.workspace_id,
        ...(includeHiddenChildren ? {} : { sidebar_hidden: false }),
      },
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.folder.findMany({
      where: {
        workspace_id: folder.workspace_id,
        space_id: folder.space_id,
        ...(includeHiddenChildren ? {} : { sidebar_hidden: false }),
      },
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      include: { _count: { select: { projects: true } } },
    }),
  ]);

  const breadcrumbs: { id: string; name: string; icon: string | null }[] = [];
  const foldersById = new Map(allFolders.map((f) => [f.id, f]));
  let cursor = folder.parent_id ? foldersById.get(folder.parent_id) : null;
  while (cursor) {
    breadcrumbs.unshift({ id: cursor.id, name: cursor.name, icon: cursor.icon });
    cursor = cursor.parent_id ? foldersById.get(cursor.parent_id) : null;
  }

  const { space, parent: _parent, ...folderData } = folder;
  void _parent;
  return NextResponse.json({
    folder: folderData,
    space,
    breadcrumbs,
    children: findFolderNode(buildFolderTree(allFolders as never), folder.id)?.children ?? [],
    projects,
  });
}

async function PATCH_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, folder.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isWorkspaceAdminFor(auth, folder.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    icon?: string | null;
    position?: number;
    space_id?: string;
    parent_id?: string | null;
  };
  let trimmedName: string | undefined;
  if (body.name !== undefined) {
    trimmedName = body.name.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
  }
  const nextSpaceId = body.space_id ?? folder.space_id;
  if (body.space_id && body.space_id !== folder.space_id) {
    const space = await prisma.space.findUnique({ where: { id: body.space_id } });
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
    if (space.workspace_id !== folder.workspace_id) {
      return NextResponse.json(
        { error: "Cannot move folder across workspaces" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Move the folder within the current space or create an explicit cross-space move flow" },
      { status: 400 },
    );
  }

  let nextParentId: string | null | undefined = undefined;
  if (body.parent_id !== undefined) {
    nextParentId = body.parent_id;
    if (nextParentId) {
      const parent = await prisma.folder.findUnique({
        where: { id: nextParentId },
        select: { id: true, workspace_id: true, space_id: true },
      });
      if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 400 });
      if (parent.workspace_id !== folder.workspace_id || parent.space_id !== nextSpaceId) {
        return NextResponse.json(
          { error: "Parent folder must stay in the same workspace and space" },
          { status: 400 },
        );
      }
    }

    const allFolders = await prisma.folder.findMany({
      where: { workspace_id: folder.workspace_id, space_id: folder.space_id },
      select: { id: true, parent_id: true },
    });
    if (wouldCreateFolderCycle(allFolders, folder.id, nextParentId)) {
      return NextResponse.json({ error: "Folder move would create a cycle" }, { status: 400 });
    }
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: {
      ...(trimmedName !== undefined && { name: trimmedName }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.position !== undefined && { position: body.position }),
      ...(body.space_id !== undefined && { space_id: body.space_id }),
      ...(nextParentId !== undefined && { parent_id: nextParentId }),
    },
    include: { _count: { select: { projects: true } } },
  });
  await recordActivity({
    workspace_id: folder.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "folder_updated",
    entity_type: "folder",
    entity_id: folder.id,
    metadata: {
      name: updated.name,
      parent_id: updated.parent_id,
      previous_parent_id: folder.parent_id,
    },
  });
  return NextResponse.json(updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id } = await params;

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, folder.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isWorkspaceAdminFor(auth, folder.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const allFolders = await tx.folder.findMany({
      where: { workspace_id: folder.workspace_id, space_id: folder.space_id },
      select: { id: true, parent_id: true },
    });
    const folderIds = [folder.id, ...getDescendantFolderIds(allFolders, folder.id)];
    const projects = await tx.project.findMany({
      where: {
        workspace_id: folder.workspace_id,
        folder_id: { in: folderIds },
      },
      select: { id: true, workspace_id: true },
    });
    const projectDeletes = await deleteProjectsByIds(tx, projects);
    const folderDeletes = await tx.folder.deleteMany({
      where: { id: { in: folderIds }, workspace_id: folder.workspace_id },
    });

    return {
      folders: folderDeletes.count,
      lists: projectDeletes.projects,
      projects: projectDeletes.projects,
      nested_folders: Math.max(folderDeletes.count - 1, 0),
      project_records: { ...projectDeletes },
    };
  });
  await recordActivity({
    workspace_id: folder.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "folder_deleted",
    entity_type: "folder",
    entity_id: folder.id,
    metadata: {
      name: folder.name,
      parent_id: folder.parent_id,
      recursive_delete: true,
      deleted,
    },
  });
  return NextResponse.json({ success: true, deleted });
}
export const GET = withErrorReporting("api:folders/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:folders/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:folders/id:DELETE", DELETE_handler);
