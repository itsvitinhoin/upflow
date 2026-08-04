import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

type RouteContext = { params: Promise<{ id: string }> };

async function findActiveWorkspaceSpace(id: string, workspaceId: string | null) {
  if (!workspaceId) return null;

  return prisma.space.findFirst({
    where: { id, workspace_id: workspaceId },
    select: { id: true, workspace_id: true },
  });
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

  const space = await findActiveWorkspaceSpace(id, auth.currentWorkspaceId);
  if (!space || !canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [items, projects] = await Promise.all([
    prisma.doc.findMany({
      where: {
        workspace_id: space.workspace_id,
        project: {
          is: {
            space_id: space.id,
            workspace_id: space.workspace_id,
          },
        },
      },
      orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      include: {
        project: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        workspace_id: space.workspace_id,
        space_id: space.id,
        status: { not: "archived" },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({ items, projects });
}

async function POST_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const space = await findActiveWorkspaceSpace(id, auth.currentWorkspaceId);
  if (!space || !canAccessWorkspace(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isWorkspaceAdminFor(auth, space.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { title?: string; project_id?: string };
  if (!body.project_id) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: {
      id: body.project_id,
      workspace_id: space.workspace_id,
      space_id: space.id,
      status: { not: "archived" },
    },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found in this Space" }, { status: 404 });
  }

  const title = body.title?.trim() || "Untitled";
  const doc = await prisma.doc.create({
    data: {
      title,
      project_id: project.id,
      workspace_id: space.workspace_id,
      author_id: auth.prismaUser.id,
      content: Prisma.JsonNull,
    },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(doc, { status: 201 });
}

export const GET = withErrorReporting("api:spaces/id/docs:GET", GET_handler);
export const POST = withErrorReporting("api:spaces/id/docs:POST", POST_handler);
