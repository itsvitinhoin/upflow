import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const UpdateNoteSchema = z.object({
  body: z.string().trim().min(1),
});

async function getScopedNote(companyId: string, noteId: string, workspaceId: string) {
  return prisma.companyNote.findFirst({
    where: {
      id: noteId,
      company_id: companyId,
      workspace_id: workspaceId,
    },
    include: { company: { select: { id: true, name: true, owner_id: true, workspace_id: true } } },
  });
}

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string; noteId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const note = await getScopedNote(params.id, params.noteId, auth.currentWorkspaceId);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canManage =
    note.author_id === auth.prismaUser.id ||
    note.company.owner_id === auth.prismaUser.id ||
    isWorkspaceAdminFor(auth, note.workspace_id);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = UpdateNoteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid note", issues: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.companyNote.update({
    where: { id: note.id },
    data: { body: parsed.data.body },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await recordActivity({
    workspace_id: note.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "company_note_updated",
    entity_type: "company_note",
    entity_id: note.id,
    company_id: note.company_id,
    metadata: { company_name: note.company.name },
  });

  return NextResponse.json(updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string; noteId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  void req;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const note = await getScopedNote(params.id, params.noteId, auth.currentWorkspaceId);
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canManage =
    note.author_id === auth.prismaUser.id ||
    note.company.owner_id === auth.prismaUser.id ||
    isWorkspaceAdminFor(auth, note.workspace_id);
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.companyNote.delete({ where: { id: note.id } });

  await recordActivity({
    workspace_id: note.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "company_note_deleted",
    entity_type: "company_note",
    entity_id: note.id,
    company_id: note.company_id,
    metadata: { company_name: note.company.name },
  });

  return NextResponse.json({ success: true });
}

export const PATCH = withErrorReporting("api:companies/id/notes/noteId:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:companies/id/notes/noteId:DELETE", DELETE_handler);
