import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function GET_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const doc = await prisma.doc.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, doc.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(doc);
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const existing = await prisma.doc.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, existing.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.author_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, existing.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { title?: string; content?: unknown };
  const { title, content } = body;

  const doc = await prisma.doc.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && {
        content:
          content === null
            ? Prisma.JsonNull
            : (content as Prisma.InputJsonValue),
      }),
    },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(doc);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;

  const existing = await prisma.doc.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, existing.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.author_id !== auth.prismaUser.id && !isWorkspaceAdminFor(auth, existing.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.doc.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
export const GET = withErrorReporting("api:docs/id:GET", GET_handler);
export const PATCH = withErrorReporting("api:docs/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:docs/id:DELETE", DELETE_handler);
