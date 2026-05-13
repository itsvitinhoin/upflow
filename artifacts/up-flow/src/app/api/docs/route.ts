import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const isAdmin = auth.prismaUser.role === "admin";
  const userId = auth.prismaUser.id;

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { owner_id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!isAdmin && project.owner_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const where = projectId
    ? { project_id: projectId }
    : isAdmin
      ? undefined
      : { project: { owner_id: userId } };

  const docs = await prisma.doc.findMany({
    where,
    orderBy: { updated_at: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { title?: string; project_id?: string };
  const { title, project_id } = body;
  const userId = auth.prismaUser.id;

  let pid = project_id;
  if (pid) {
    const target = await prisma.project.findUnique({ where: { id: pid } });
    if (!target) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (auth.prismaUser.role !== "admin" && target.owner_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const firstProject = await prisma.project.findFirst({
      where: { owner_id: userId },
      orderBy: { created_at: "desc" },
    });
    if (!firstProject) {
      return NextResponse.json(
        { error: "Create a project first before adding docs" },
        { status: 400 }
      );
    }
    pid = firstProject.id;
  }

  const doc = await prisma.doc.create({
    data: {
      title: title || "Untitled",
      project_id: pid,
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
