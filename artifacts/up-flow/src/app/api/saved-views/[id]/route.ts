import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-response";
import { requireCurrentWorkspace } from "@/lib/api/scope";
import { withErrorReporting } from "@/lib/with-error-reporting";

const UpdateSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  config: z.record(z.unknown()).optional(),
});

async function PATCH_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;

  const existing = await prisma.savedView.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId, user_id: auth.prismaUser.id },
  });
  if (!existing) return NextResponse.json({ error: "Saved view not found" }, { status: 404 });

  const parsed = UpdateSavedViewSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid saved view", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await prisma.savedView.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.config !== undefined && {
        config: parsed.data.config as Prisma.InputJsonValue,
      }),
    },
  });

  return NextResponse.json(updated);
}

async function DELETE_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const scope = await requireCurrentWorkspace(auth);
  if (!scope.ok) return scope.response;
  void req;

  const existing = await prisma.savedView.findFirst({
    where: { id: params.id, workspace_id: scope.workspaceId, user_id: auth.prismaUser.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Saved view not found" }, { status: 404 });

  await prisma.savedView.delete({ where: { id: existing.id } });
  return NextResponse.json({ success: true });
}

export const PATCH = withErrorReporting("api:saved-views/id:PATCH", PATCH_handler);
export const DELETE = withErrorReporting("api:saved-views/id:DELETE", DELETE_handler);
