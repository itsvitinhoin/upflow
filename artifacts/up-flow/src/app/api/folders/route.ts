import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { buildFolderTree } from "@/lib/folder-tree";
import { buildPage, parsePagination } from "@/lib/pagination";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: [], nextCursor: null });
  }
  const { limit, cursor } = parsePagination(req, { defaultLimit: 200, maxLimit: 500 });
  const { searchParams } = new URL(req.url);
  const tree = searchParams.get("tree") === "true";
  const spaceId = searchParams.get("space_id")?.trim();

  const rows = await prisma.folder.findMany({
    where: {
      workspace_id: auth.currentWorkspaceId,
      ...(spaceId && { space_id: spaceId }),
    },
    ...(tree ? {} : { take: limit + 1 }),
    ...(tree || !cursor ? {} : { skip: 1, cursor: { id: cursor } }),
    orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
    include: {
      _count: { select: { projects: true } },
    },
  });

  if (tree) {
    return NextResponse.json({ items: buildFolderTree(rows as never), nextCursor: null });
  }

  return NextResponse.json(buildPage(rows, limit));
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }
  if (!isWorkspaceAdminFor(auth, auth.currentWorkspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    icon?: string | null;
    space_id?: string;
    parent_id?: string | null;
  };
  const name = body.name?.trim();
  const space_id = body.space_id;
  const parent_id = body.parent_id ?? null;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!space_id) return NextResponse.json({ error: "space_id is required" }, { status: 400 });

  const space = await prisma.space.findUnique({ where: { id: space_id } });
  if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
  if (!canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isWorkspaceAdminFor(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parent: { id: string; space_id: string; workspace_id: string } | null = null;
  if (parent_id) {
    parent = await prisma.folder.findUnique({
      where: { id: parent_id },
      select: { id: true, space_id: true, workspace_id: true },
    });
    if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 400 });
    if (parent.workspace_id !== space.workspace_id || parent.space_id !== space.id) {
      return NextResponse.json(
        { error: "Parent folder must be in the same space and workspace" },
        { status: 400 },
      );
    }
  }

  const last = await prisma.folder.findFirst({
    where: { space_id, parent_id },
    orderBy: { position: "desc" },
  });
  const position = (last?.position ?? -1) + 1;

  const folder = await prisma.folder.create({
    data: {
      name,
      icon: body.icon ?? null,
      space_id,
      parent_id,
      workspace_id: space.workspace_id,
      owner_id: auth.prismaUser.id,
      position,
    },
    include: { _count: { select: { projects: true } } },
  });
  await recordActivity({
    workspace_id: space.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "folder_created",
    entity_type: "folder",
    entity_id: folder.id,
    metadata: { name: folder.name, space_id, parent_id },
  });
  return NextResponse.json(folder, { status: 201 });
}
export const GET = withErrorReporting("api:folders:GET", GET_handler);
export const POST = withErrorReporting("api:folders:POST", POST_handler);
