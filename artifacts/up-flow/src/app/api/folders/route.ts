import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: [], nextCursor: null });
  }
  const { limit, cursor } = parsePagination(req, { defaultLimit: 200, maxLimit: 500 });

  const rows = await prisma.folder.findMany({
    where: { workspace_id: auth.currentWorkspaceId },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
    include: {
      _count: { select: { projects: true } },
    },
  });

  return NextResponse.json(buildPage(rows, limit));
}

export async function POST(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  const body = (await req.json()) as {
    name?: string;
    icon?: string | null;
    space_id?: string;
  };
  const name = body.name?.trim();
  const space_id = body.space_id;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!space_id) return NextResponse.json({ error: "space_id is required" }, { status: 400 });

  const space = await prisma.space.findUnique({ where: { id: space_id } });
  if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
  if (!canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const last = await prisma.folder.findFirst({
    where: { space_id },
    orderBy: { position: "desc" },
  });
  const position = (last?.position ?? -1) + 1;

  const folder = await prisma.folder.create({
    data: {
      name,
      icon: body.icon ?? null,
      space_id,
      workspace_id: space.workspace_id,
      owner_id: auth.prismaUser.id,
      position,
    },
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json(folder, { status: 201 });
}
