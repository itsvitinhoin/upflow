import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthUser,
  isWorkspaceAdmin,
} from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.currentWorkspaceId) {
    return NextResponse.json([], { status: 200 });
  }
  void req;
  const spaces = await prisma.space.findMany({
    where: { workspace_id: auth.currentWorkspaceId },
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { projects: true } },
    },
  });

  return NextResponse.json(spaces);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }
  // Any workspace member can create a space.
  const body = (await req.json()) as { name?: string; icon?: string | null };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const last = await prisma.space.findFirst({
    where: { workspace_id: auth.currentWorkspaceId },
    orderBy: { position: "desc" },
  });
  const position = (last?.position ?? -1) + 1;

  const space = await prisma.space.create({
    data: {
      name,
      icon: body.icon ?? null,
      workspace_id: auth.currentWorkspaceId,
      owner_id: auth.prismaUser.id,
      position,
    },
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json(space, { status: 201 });
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ensureWorkspaceAdminImported = isWorkspaceAdmin;
