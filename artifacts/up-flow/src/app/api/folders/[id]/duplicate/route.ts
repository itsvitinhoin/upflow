import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { duplicateFolder } from "@/lib/project-duplicate";
import { withErrorReporting } from "@/lib/with-error-reporting";

type RouteContext = { params: Promise<{ id: string }> };

async function POST_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  const { id } = await params;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  const source = await prisma.folder.findFirst({
    where: { id, workspace_id: auth.currentWorkspaceId },
    select: { id: true, name: true, workspace_id: true },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, source.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isWorkspaceAdminFor(auth, source.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const duplicate = await prisma.$transaction((tx) =>
    duplicateFolder(tx, { sourceFolderId: source.id, actorId: auth.prismaUser.id }),
  );
  if (!duplicate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordActivity({
    workspace_id: source.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "folder_duplicated",
    entity_type: "folder",
    entity_id: duplicate.folder.id,
    metadata: {
      source_folder_id: source.id,
      source_folder_name: source.name,
      copied: duplicate.copied,
    },
  });

  return NextResponse.json(duplicate, { status: 201 });
}

export const POST = withErrorReporting("api:folders/id/duplicate:POST", POST_handler);
