import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";

const SpaceIdSchema = z.string().uuid();

function parseSpaceId(spaceId: string) {
  const parsed = SpaceIdSchema.safeParse(spaceId);
  return parsed.success ? parsed.data : null;
}

async function POST_handler(
  req: NextRequest,
  { params }: { params: { spaceId: string } },
) {
  void req;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  const spaceId = parseSpaceId(params.spaceId);
  if (!spaceId) {
    return NextResponse.json({ error: "Invalid space" }, { status: 400 });
  }

  const space = await prisma.space.findFirst({
    where: { id: spaceId, workspace_id: auth.currentWorkspaceId },
    select: { id: true },
  });
  if (!space)
    return NextResponse.json({ error: "Space not found" }, { status: 404 });

  await prisma.sidebarSpaceHide.upsert({
    where: {
      workspace_id_user_id_space_id: {
        workspace_id: auth.currentWorkspaceId,
        user_id: auth.prismaUser.id,
        space_id: space.id,
      },
    },
    update: {},
    create: {
      workspace_id: auth.currentWorkspaceId,
      user_id: auth.prismaUser.id,
      space_id: space.id,
    },
  });

  return NextResponse.json({ success: true });
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { spaceId: string } },
) {
  void req;
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  const spaceId = parseSpaceId(params.spaceId);
  if (!spaceId) {
    return NextResponse.json({ error: "Invalid space" }, { status: 400 });
  }

  await prisma.sidebarSpaceHide.deleteMany({
    where: {
      workspace_id: auth.currentWorkspaceId,
      user_id: auth.prismaUser.id,
      space_id: spaceId,
    },
  });

  return NextResponse.json({ success: true });
}

export const POST = withErrorReporting("api:my-space-hides:POST", POST_handler);
export const DELETE = withErrorReporting(
  "api:my-space-hides:DELETE",
  DELETE_handler,
);
