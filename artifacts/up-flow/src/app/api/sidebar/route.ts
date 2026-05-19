import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({
      spaces: { items: [], nextCursor: null },
      projects: { items: [], nextCursor: null },
      folders: { items: [], nextCursor: null },
    });
  }

  const [spaces, projects, folders] = await Promise.all([
    prisma.space.findMany({
      where: { workspace_id: auth.currentWorkspaceId },
      take: 200,
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { projects: true } },
      },
    }),
    prisma.project.findMany({
      where: { workspace_id: auth.currentWorkspaceId },
      take: 200,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        space: { select: { id: true, name: true, icon: true } },
        folder: { select: { id: true, name: true, icon: true } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.folder.findMany({
      where: { workspace_id: auth.currentWorkspaceId },
      take: 200,
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      include: {
        _count: { select: { projects: true } },
      },
    }),
  ]);

  return NextResponse.json({
    spaces: { items: spaces, nextCursor: null },
    projects: { items: projects, nextCursor: null },
    folders: { items: folders, nextCursor: null },
  });
}

export const GET = withErrorReporting("api:sidebar:GET", GET_handler);
