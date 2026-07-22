import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { readableProjectWhere } from "@/lib/project-access";
import {
  buildFolderBreadcrumb,
  type SidebarSearchResult,
} from "@/lib/sidebar-discovery";
import {
  addProjectPendingTodoCounts,
  countPendingTodoTasks,
} from "@/lib/sidebar-pending-tasks";
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
      search_results: [],
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
    AND: [
      readableProjectsWhere,
      { sidebar_hidden: false },
    ],
  };
  // Select the navigation fields explicitly so a release can still read
  // existing spaces while a newly introduced optional UI column is rolling out.
  const spaceSelect = {
    id: true,
    name: true,
    icon: true,
    workspace_id: true,
    owner_id: true,
    position: true,
    created_at: true,
    owner: { select: { id: true, name: true, email: true } },
    _count: { select: { projects: { where: visibleProjectWhere } } },
    projects: {
      where: visibleProjectWhere,
      select: {
        _count: {
          select: {
            tasks: { where: { status: "todo" as const } },
          },
        },
      },
    },
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
  const withPendingTodoCount = <
    T extends { projects: Array<{ _count: { tasks: number } }> },
  >(
    space: T,
  ) => {
    const { projects: spaceProjects, ...spaceData } = space;
    return {
      ...spaceData,
      pending_todo_count: countPendingTodoTasks(spaceProjects),
    };
  };

  const withProjectPendingTodoCounts = async <T extends { id: string }>(
    projectRows: T[],
  ): Promise<Array<T & { pending_todo_count: number }>> => {
    if (projectRows.length === 0) return [];

    const taskCounts = await prisma.task.groupBy({
      by: ["project_id"],
      where: {
        project_id: { in: projectRows.map((project) => project.id) },
        status: "todo",
      },
      _count: { _all: true },
    });

    return addProjectPendingTodoCounts(projectRows, taskCounts);
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
        select: spaceSelect,
      }),
      prisma.project.findMany({
        where: {
          AND: [
            visibleProjectWhere,
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

    const sidebarProjects = await withProjectPendingTodoCounts(matchingProjects);

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
            select: spaceSelect,
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
    const sidebarSpaces = spaces.map(withPendingTodoCount);
    const spaceById = new Map(sidebarSpaces.map((space) => [space.id, space]));
    const searchResults: SidebarSearchResult[] = [];

    for (const space of matchingSpaces) {
      searchResults.push({
        id: space.id,
        type: "space",
        name: space.name,
        href: `/spaces/${space.id}`,
        breadcrumb: [space.name],
      });
    }

    for (const folder of matchingFolders) {
      const space = spaceById.get(folder.space_id);
      searchResults.push({
        id: folder.id,
        type: "folder",
        name: folder.name,
        href: `/folders/${folder.id}`,
        breadcrumb: [
          space?.name ?? "Unassigned",
          ...buildFolderBreadcrumb(folder.id, folderById),
        ],
      });
    }

    for (const project of matchingProjects) {
      const folder = project.folder_id ? folderById.get(project.folder_id) : undefined;
      const spaceId = project.space_id ?? folder?.space_id;
      const space = spaceId ? spaceById.get(spaceId) : undefined;
      searchResults.push({
        id: project.id,
        type: "project",
        name: project.name,
        href: `/projects/${project.id}`,
        breadcrumb: [
          space?.name ?? "Unassigned",
          ...buildFolderBreadcrumb(project.folder_id, folderById),
          project.name,
        ],
      });
    }

    const resultOrder = { space: 0, folder: 1, project: 2 } as const;
    searchResults.sort(
      (a, b) =>
        resultOrder[a.type] - resultOrder[b.type] ||
        a.breadcrumb.join("/").localeCompare(b.breadcrumb.join("/")),
    );

    return NextResponse.json({
      spaces: { items: sidebarSpaces, nextCursor: null },
      projects: { items: sidebarProjects, nextCursor: null },
      folders: { items: folders, nextCursor: null },
      pinned_clients: pinnedClients,
      search_results: searchResults,
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
      select: spaceSelect,
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

  const sidebarProjects = await withProjectPendingTodoCounts(projects);

  return NextResponse.json({
    spaces: buildPage(spaces.map(withPendingTodoCount), limit),
    projects: buildPage(sidebarProjects, limit),
    folders: buildPage(folders, limit),
    pinned_clients: pinnedClients,
    search_results: [],
  });
}

export const GET = withErrorReporting("api:sidebar:GET", GET_handler);
