import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { recordActivity } from "@/lib/activity";
import { withErrorReporting } from "@/lib/with-error-reporting";

const NoteSchema = z.object({
  body: z.string().trim().min(1),
});

async function POST_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const company = await prisma.company.findFirst({
    where: { id: params.id, workspace_id: auth.currentWorkspaceId },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = NoteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid note", issues: parsed.error.flatten() }, { status: 400 });
  }

  const note = await prisma.companyNote.create({
    data: {
      workspace_id: company.workspace_id,
      company_id: company.id,
      author_id: auth.prismaUser.id,
      body: parsed.data.body,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  await recordActivity({
    workspace_id: company.workspace_id,
    actor_id: auth.prismaUser.id,
    type: "company_note_created",
    entity_type: "company_note",
    entity_id: note.id,
    company_id: company.id,
    metadata: { company_name: company.name },
  });

  return NextResponse.json(note, { status: 201 });
}

export const POST = withErrorReporting("api:companies/id/notes:POST", POST_handler);
