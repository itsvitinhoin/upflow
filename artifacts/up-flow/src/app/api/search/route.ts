import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

const MAX_PER_TYPE = 20;

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ q: "", tasks: [], projects: [], docs: [] });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const userId = auth.prismaUser.id;
  const isAdmin = auth.prismaUser.role === "admin";

  const projectScope = isAdmin
    ? {}
    : { OR: [{ owner_id: userId }, { tasks: { some: { assignee_id: userId } } }] };

  const taskScope = isAdmin
    ? {}
    : { OR: [{ assignee_id: userId }, { project: { owner_id: userId } }] };

  const [tasks, projects, docs] = await Promise.all([
    prisma.task.findMany({
      where: {
        AND: [
          taskScope,
          {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      take: MAX_PER_TYPE,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        AND: [
          projectScope,
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      take: MAX_PER_TYPE,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        space: { select: { id: true, name: true, icon: true } },
      },
    }),
    prisma.doc.findMany({
      where: {
        AND: [
          isAdmin
            ? {}
            : {
                OR: [
                  { author_id: userId },
                  { project: { owner_id: userId } },
                ],
              },
          { title: { contains: q, mode: "insensitive" } },
        ],
      },
      take: MAX_PER_TYPE,
      orderBy: { updated_at: "desc" },
      select: {
        id: true,
        title: true,
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({ q, tasks, projects, docs });
}
