import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const doc = await prisma.doc.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true, owner_id: true } },
      author: { select: { id: true, name: true } },
    },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = auth.prismaUser.role === "admin";
  if (!isAdmin && doc.project.owner_id !== auth.prismaUser.id && doc.author_id !== auth.prismaUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { project, ...rest } = doc;
  return NextResponse.json({
    ...rest,
    project: { id: project.id, name: project.name },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prismaUser } = auth;

  const existing = await prisma.doc.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.author_id !== prismaUser.id && prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { title?: string; content?: unknown };
  const { title, content } = body;

  const doc = await prisma.doc.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
    },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(doc);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  void req;

  const { prismaUser } = auth;

  const existing = await prisma.doc.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.author_id !== prismaUser.id && prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.doc.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
