import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { readableProjectWhere } from "@/lib/project-access";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const dynamic = "force-dynamic";

const MAX_PER_TYPE = 20;

const projectContextSelect = {
  id: true,
  name: true,
  kind: true,
  company: { select: { id: true, name: true } },
  space: { select: { id: true, name: true, icon: true } },
  folder: { select: { id: true, name: true, icon: true } },
} as const;

async function GET_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, { windowMs: 60_000, max: 60, key: "search" });
  if (!rl.ok) return rateLimitResponse(rl);

  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ q: "", spaces: [], tasks: [], projects: [], docs: [], companies: [] });
  }
  if (q.length > 200) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  // Search is scoped to the caller's active workspace.
  const workspaceId = auth.currentWorkspaceId;
  if (!workspaceId) {
    return NextResponse.json({ q, spaces: [], tasks: [], projects: [], docs: [], companies: [] });
  }

  const projectScope = readableProjectWhere(auth, workspaceId);
  const taskScope = { project: projectScope };
  const docScope = { workspace_id: workspaceId, project: projectScope };

  const contains = { contains: q, mode: "insensitive" as const };
  const [tasks, projects, docs, companies, spaces] = await Promise.all([
    prisma.task.findMany({
      where: {
        AND: [
          taskScope,
          {
            OR: [
              { title: contains },
              { description: contains },
              { project: { name: contains } },
              { project: { company: { name: contains } } },
              { project: { space: { name: contains } } },
              { project: { folder: { name: contains } } },
            ],
          },
        ],
      },
      take: MAX_PER_TYPE,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        project: { select: projectContextSelect },
      },
    }),
    prisma.project.findMany({
      where: {
        AND: [
          projectScope,
          {
            OR: [
              { name: contains },
              { description: contains },
              { company: { name: contains } },
              { space: { name: contains } },
              { folder: { name: contains } },
            ],
          },
        ],
      },
      take: MAX_PER_TYPE,
      orderBy: { created_at: "desc" },
      select: {
        ...projectContextSelect,
        description: true,
        status: true,
      },
    }),
    prisma.doc.findMany({
      where: {
        AND: [
          docScope,
          {
            OR: [
              { title: contains },
              { project: { name: contains } },
              { project: { company: { name: contains } } },
              { project: { space: { name: contains } } },
              { project: { folder: { name: contains } } },
            ],
          },
        ],
      },
      take: MAX_PER_TYPE,
      orderBy: { updated_at: "desc" },
      select: {
        id: true,
        title: true,
        project: { select: projectContextSelect },
      },
    }),
    prisma.company.findMany({
      where: {
        workspace_id: workspaceId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { plan_name: { contains: q, mode: "insensitive" } },
          { service_type: { contains: q, mode: "insensitive" } },
          { owner: { is: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
      take: MAX_PER_TYPE,
      orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        plan_name: true,
        owner: { select: { id: true, name: true } },
      },
    }),
    prisma.space.findMany({
      where: {
        workspace_id: workspaceId,
        name: contains,
      },
      take: MAX_PER_TYPE,
      orderBy: [{ position: "asc" }, { created_at: "asc" }, { id: "asc" }],
      select: { id: true, name: true, icon: true },
    }),
  ]);

  return NextResponse.json({ q, spaces, tasks, projects, docs, companies });
}
export const GET = withErrorReporting("api:search:GET", GET_handler);
