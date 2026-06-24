import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { canAccessWorkspace, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { buildPage, parsePagination } from "@/lib/pagination";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspace_id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!canAccessWorkspace(auth, project.workspace_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { limit, cursor } = parsePagination(req, { defaultLimit: 200, maxLimit: 500 });

  const where = projectId
    ? { project_id: projectId }
    : { workspace_id: auth.currentWorkspaceId };

  const rows = await prisma.doc.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ updated_at: "desc" }, { id: "asc" }],
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

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

  const body = await req.json() as { title?: string; project_id?: string };
  const { title, project_id } = body;
  const userId = auth.prismaUser.id;

  let pid = project_id;
  let workspaceId: string;
  if (pid) {
    const target = await prisma.project.findUnique({ where: { id: pid } });
    if (!target) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (!canAccessWorkspace(auth, target.workspace_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isWorkspaceAdminFor(auth, target.workspace_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    workspaceId = target.workspace_id;
  } else {
    const firstProject = await prisma.project.findFirst({
      where: { workspace_id: auth.currentWorkspaceId },
      orderBy: { created_at: "desc" },
    });
    if (!firstProject) {
      return NextResponse.json(
        { error: "Create a project first before adding docs" },
        { status: 400 }
      );
    }
    pid = firstProject.id;
    workspaceId = firstProject.workspace_id;
  }

  const doc = await prisma.doc.create({
    data: {
      title: title || "Untitled",
      project_id: pid,
      workspace_id: workspaceId,
      author_id: userId,
      content: Prisma.JsonNull,
    },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
export const GET = withErrorReporting("api:docs:GET", GET_handler);
export const POST = withErrorReporting("api:docs:POST", POST_handler);
