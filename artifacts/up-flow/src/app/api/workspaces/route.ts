import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

// List the caller's workspaces + current active one.
async function GET_handler() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  return NextResponse.json({
    workspaces: auth.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
    current_workspace_id: auth.currentWorkspaceId,
    current_role: auth.currentRole,
  });
}

// Create a new workspace; caller becomes its owner.
async function POST_handler(req: Request) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const baseSlug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) ||
    "workspace";
  let slug = baseSlug;
  for (let i = 0; i < 10; i++) {
    const exists = await prisma.workspace.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      members: {
        create: { user_id: auth.prismaUser.id, role: "owner" },
      },
    },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json(workspace, { status: 201 });
}
export const GET = withErrorReporting("api:workspaces:GET", GET_handler);
export const POST = withErrorReporting("api:workspaces:POST", POST_handler);
