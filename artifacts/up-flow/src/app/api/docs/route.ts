import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");

  const docs = await prisma.doc.findMany({
    where: projectId ? { project_id: projectId } : undefined,
    orderBy: { updated_at: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, project_id } = body;
  const userId = (session.user as any).id;

  // If no project_id, pick the first project owned by user or any project
  let pid = project_id;
  if (!pid) {
    const firstProject = await prisma.project.findFirst({
      where: { owner_id: userId },
      orderBy: { created_at: "desc" },
    });
    if (!firstProject) {
      const anyProject = await prisma.project.findFirst({ orderBy: { created_at: "desc" } });
      if (!anyProject) {
        return NextResponse.json({ error: "Create a project first before adding docs" }, { status: 400 });
      }
      pid = anyProject.id;
    } else {
      pid = firstProject.id;
    }
  }

  const doc = await prisma.doc.create({
    data: {
      title: title || "Untitled",
      project_id: pid,
      author_id: userId,
      content: null,
    },
    include: {
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
