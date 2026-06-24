import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { recordActivity } from "@/lib/activity";
import { parseAppDate } from "@/lib/utils";
import { readableProjectWhere } from "@/lib/project-access";

async function getHandler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const { limit, cursor } = parsePagination(req, { defaultLimit: 200, maxLimit: 500 });

  const rows = await prisma.project.findMany({
    where: readableProjectWhere(auth, auth.currentWorkspaceId),
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
    include: {
      owner: { select: { id: true, name: true, email: true } },
      space: { select: { id: true, name: true, icon: true } },
      folder: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json(buildPage(rows, limit));
}

async function postHandler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }
  if (!isWorkspaceAdminFor(auth, auth.currentWorkspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    name?: string;
    description?: string;
    due_date?: string;
    space_id?: string | null;
    folder_id?: string | null;
    company_id?: string | null;
  };
  const { name, description, due_date, space_id, folder_id, company_id } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  let parsedDueDate: Date | null = null;
  if (due_date) {
    const d = parseAppDate(due_date);
    if (d === "invalid") {
      return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
    }
    parsedDueDate = d;
  }

  let resolvedSpaceId = space_id || null;

  if (space_id) {
    const space = await prisma.space.findUnique({ where: { id: space_id } });
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 400 });
    if (space.workspace_id !== auth.currentWorkspaceId || !canAccessWorkspace(auth, space.workspace_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (folder_id) {
    const folder = await prisma.folder.findUnique({ where: { id: folder_id } });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 400 });
    if (folder.workspace_id !== auth.currentWorkspaceId || !canAccessWorkspace(auth, folder.workspace_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (resolvedSpaceId && folder.space_id !== resolvedSpaceId) {
      return NextResponse.json(
        { error: "Folder does not belong to selected space" },
        { status: 400 },
      );
    }
    resolvedSpaceId = folder.space_id;
  }
  if (company_id) {
    const company = await prisma.company.findFirst({
      where: { id: company_id, workspace_id: auth.currentWorkspaceId },
      select: { id: true },
    });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description || null,
      due_date: parsedDueDate,
      workspace_id: auth.currentWorkspaceId,
      owner_id: auth.prismaUser.id,
      space_id: resolvedSpaceId,
      folder_id: folder_id || null,
      company_id: company_id || null,
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      space: { select: { id: true, name: true, icon: true } },
      folder: { select: { id: true, name: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });

  await recordActivity({
    workspace_id: auth.currentWorkspaceId,
    actor_id: auth.prismaUser.id,
    type: "project_created",
    entity_type: "project",
    entity_id: project.id,
    project_id: project.id,
    company_id: project.company_id,
    metadata: {
      name: project.name,
      space_id: project.space_id,
      folder_id: project.folder_id,
    },
  });

  return NextResponse.json(project, { status: 201 });
}

export const GET = withErrorReporting("api:projects:GET", getHandler);
export const POST = withErrorReporting("api:projects:POST", postHandler);

