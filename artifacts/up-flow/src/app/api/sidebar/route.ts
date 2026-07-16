import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
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
      pinned_clients: [],
    });
  }

  const { searchParams } = new URL(req.url);
  const { limit } = parsePagination(req, { defaultLimit: 200, maxLimit: 500 });
  const q = searchParams.get("q")?.trim();
  const spacesCursor = searchParams.get("spaces_cursor");
  const projectsCursor = searchParams.get("projects_cursor");
  const foldersCursor = searchParams.get("folders_cursor");
  const readableProjectsWhere = readableProjectWhere(auth, auth.currentWorkspaceId);
  const visibleProjectWhere = {
    AND: [readableProjectsWhere, { sidebar_hidden: false }],
  };
  const spaceInclude = {
    owner: { select: { id: true, name: true, email: true } },
    _count: { select: { projects: { where: visibleProjectWhere } } },
  };
  const projectInclude = {
    owner: { select: { id: true, name: true, email: true } },
    space: { select: { id: true, name: true, icon: true } },
    folder: { select: { id: true, name: true, icon: true } },
    company: {
      select: {
        id: true,
        name: true,
        contract_value: true,
        commission: true,
        plan_name: true,
        service_type: true,
      },
    },
    _count: { select: { tasks: true } },
  };
  const folderInclude = {
    _count: { select: { projects: { where: visibleProjectWhere } } },
  };

  if (q) {
    const [matchingSpaces, matchingProjects, matchingFolders, pinnedClients] = await Promise.all([
      prisma.space.findMany({
        where: {
          workspace_id: auth.currentWorkspaceId,
          name: { contains: q, mode: "insensitive" as const },
        },
        take: limit,
        orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
        include: spaceInclude,
      }),
      prisma.project.findMany({
        where: {
          AND: [
            readableProjectsWhere,
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { company: { is: { name: { contains: q, mode: "insensitive" as const } } } },
              ],
            },
          ],
        },
        take: limit,
        orderBy: [{ created_at: "desc" }, { id: "asc" }],
        include: projectInclude,
      }),
      prisma.folder.findMany({
        where: {
          workspace_id: auth.currentWorkspaceId,
          name: { contains: q, mode: "insensitive" as const },
        },
        take: limit,
        orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
        include: folderInclude,
      }),
      prisma.sidebarClientPin.findMany({
        where: {
          workspace_id: auth.currentWorkspaceId,
          user_id: auth.prismaUser.id,
        },
        orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
        select: {
          id: true,
          company_id: true,
          position: true,
          company: {
            select: {
              id: true,
              name: true,
              status: true,
              commercial_status: true,
              plan_name: true,
            },
          },
        },
      }),
    ]);

    const folderById = new Map(matchingFolders.map((folder) => [folder.id, folder]));
    const pendingFolderIds = new Set<string>();
    const addFolderContext = (folderId: string | null | undefined) => {
      if (folderId && !folderById.has(folderId)) pendingFolderIds.add(folderId);
    };

    for (const folder of matchingFolders) addFolderContext(folder.parent_id);
    for (const project of matchingProjects) addFolderContext(project.folder_id);

    while (pendingFolderIds.size > 0) {
      const batchIds = Array.from(pendingFolderIds);
      pendingFolderIds.clear();
      const parentFolders = await prisma.folder.findMany({
        where: {
          id: { in: batchIds },
          workspace_id: auth.currentWorkspaceId,
        },
        include: folderInclude,
      });
      for (const folder of parentFolders) {
        if (!folderById.has(folder.id)) {
          folderById.set(folder.id, folder);
          addFolderContext(folder.parent_id);
        }
      }
    }

    const spaceIds = new Set(matchingSpaces.map((space) => space.id));
    for (const folder of folderById.values()) spaceIds.add(folder.space_id);
    for (const project of matchingProjects) {
      if (project.space_id) spaceIds.add(project.space_id);
    }

    const missingSpaceIds = Array.from(spaceIds).filter(
      (id) => !matchingSpaces.some((space) => space.id === id),
    );
    const parentSpaces =
      missingSpaceIds.length > 0
        ? await prisma.space.findMany({
            where: {
              id: { in: missingSpaceIds },
              workspace_id: auth.currentWorkspaceId,
            },
            orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
            include: spaceInclude,
          })
        : [];

    const spaces = [...matchingSpaces, ...parentSpaces].sort((a, b) => {
      const positionDelta = (a.position ?? 0) - (b.position ?? 0);
      if (positionDelta !== 0) return positionDelta;
      return a.name.localeCompare(b.name);
    });
    const folders = Array.from(folderById.values()).sort((a, b) => {
      const positionDelta = (a.position ?? 0) - (b.position ?? 0);
      if (positionDelta !== 0) return positionDelta;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      spaces: { items: spaces, nextCursor: null },
      projects: { items: matchingProjects, nextCursor: null },
      folders: { items: folders, nextCursor: null },
      pinned_clients: pinnedClients,
    });
  }

  const [spaces, projects, folders, pinnedClients] = await Promise.all([
    prisma.space.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        ...(q && { name: { contains: q, mode: "insensitive" as const } }),
      },
      take: limit + 1,
      ...(spacesCursor ? { skip: 1, cursor: { id: spacesCursor } } : {}),
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      include: spaceInclude,
    }),
    prisma.project.findMany({
      where: {
        ...visibleProjectWhere,
        ...(q && { name: { contains: q, mode: "insensitive" as const } }),
      },
      take: limit + 1,
      ...(projectsCursor ? { skip: 1, cursor: { id: projectsCursor } } : {}),
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      include: projectInclude,
    }),
    prisma.folder.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        sidebar_hidden: false,
        ...(q && { name: { contains: q, mode: "insensitive" as const } }),
      },
      take: limit + 1,
      ...(foldersCursor ? { skip: 1, cursor: { id: foldersCursor } } : {}),
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      include: folderInclude,
    }),
    prisma.sidebarClientPin.findMany({
      where: {
        workspace_id: auth.currentWorkspaceId,
        user_id: auth.prismaUser.id,
      },
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      select: {
        id: true,
        company_id: true,
        position: true,
        company: {
          select: {
            id: true,
            name: true,
            status: true,
            commercial_status: true,
            plan_name: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    spaces: buildPage(spaces, limit),
    projects: buildPage(projects, limit),
    folders: buildPage(folders, limit),
    pinned_clients: pinnedClients,
  });
}

export const GET = withErrorReporting("api:sidebar:GET", GET_handler);
