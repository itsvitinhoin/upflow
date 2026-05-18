import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_PER_TYPE = 20;

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, { windowMs: 60_000, max: 60, key: "search" });
  if (!rl.ok) return rateLimitResponse(rl);

  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ q: "", tasks: [], projects: [], docs: [] });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  // Search is scoped to the caller's active workspace.
  const workspaceId = auth.currentWorkspaceId;
  if (!workspaceId) {
    return NextResponse.json({ q, tasks: [], projects: [], docs: [] });
  }

  const projectScope = { workspace_id: workspaceId };
  const taskScope = { project: { workspace_id: workspaceId } };
  const docScope = { workspace_id: workspaceId };

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
        AND: [docScope, { title: { contains: q, mode: "insensitive" } }],
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
