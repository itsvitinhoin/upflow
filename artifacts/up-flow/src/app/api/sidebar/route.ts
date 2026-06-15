import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdmin } from "@/lib/auth-helpers";
import { ensureDepartmentSpaces } from "@/lib/department-spaces";
import { buildPage, parsePagination } from "@/lib/pagination";
import { readableProjectWhere } from "@/lib/project-access";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

async function GET_handler(req: NextRequest) {
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

  if (isWorkspaceAdmin(auth)) {
    await ensureDepartmentSpaces(auth.currentWorkspaceId, auth.prismaUser.id);
  }

  const { searchParams } = new URL(req.url);
  const { limit } = parsePagination(req, { defaultLimit: 200, maxLimit: 500 });
  const q = searchParams.get("q")?.trim();
  const spacesCursor = searchParams.get("spaces_cursor");
  const projectsCursor = searchParams.get("projects_cursor");
  const foldersCursor = searchParams.get("folders_cursor");
  const visibleProjectWhere = readableProjectWhere(auth, auth.currentWorkspaceId);

  const [spaces, projects, folders] = await Promise.all([
    prisma.space.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        ...(q && { name: { contains: q, mode: "insensitive" as const } }),
      },
      take: limit + 1,
      ...(spacesCursor ? { skip: 1, cursor: { id: spacesCursor } } : {}),
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { projects: { where: visibleProjectWhere } } },
      },
    }),
    prisma.project.findMany({
      where: {
        ...visibleProjectWhere,
        ...(q && { name: { contains: q, mode: "insensitive" as const } }),
      },
      take: limit + 1,
      ...(projectsCursor ? { skip: 1, cursor: { id: projectsCursor } } : {}),
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      include: {
        owner: { select: { id: true, name: true, email: true } },
        space: { select: { id: true, name: true, icon: true } },
        folder: { select: { id: true, name: true, icon: true } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.folder.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        ...(q && { name: { contains: q, mode: "insensitive" as const } }),
      },
      take: limit + 1,
      ...(foldersCursor ? { skip: 1, cursor: { id: foldersCursor } } : {}),
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      include: {
        _count: { select: { projects: { where: visibleProjectWhere } } },
      },
    }),
  ]);

  return NextResponse.json({
    spaces: buildPage(spaces, limit),
    projects: buildPage(projects, limit),
    folders: buildPage(folders, limit),
  });
}

export const GET = withErrorReporting("api:sidebar:GET", GET_handler);
