import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
  type AuthUser,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";

async function assertCanEdit(
  projectId: string,
  fieldId: string,
  auth: AuthUser,
): Promise<{ ok: true } | { ok: false; status: number }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspace_id: true },
  });
  if (!project) return { ok: false, status: 404 };
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return { ok: false, status: 403 };
  }
  if (!isWorkspaceAdminFor(auth, project.workspace_id)) {
    return { ok: false, status: 403 };
  }
  const field = await prisma.customFieldDefinition.findUnique({
    where: { id: fieldId },
    select: { project_id: true },
  });
  if (!field || field.project_id !== projectId) {
    return { ok: false, status: 404 };
  }
  return { ok: true };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; fieldId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const guard = await assertCanEdit(params.id, params.fieldId, auth);
  if (!guard.ok) {
    const message = guard.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    options?: unknown;
    position?: number;
  };

  const updated = await prisma.customFieldDefinition.update({
    where: { id: params.fieldId },
    data: {
      ...(body.name !== undefined && { name: String(body.name).trim() }),
      ...(body.options !== undefined && {
        options: Array.isArray(body.options)
          ? (body.options as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      }),
      ...(body.position !== undefined && { position: body.position }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; fieldId: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const guard = await assertCanEdit(params.id, params.fieldId, auth);
  if (!guard.ok) {
    const message = guard.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  await prisma.customFieldDefinition.delete({ where: { id: params.fieldId } });
  return NextResponse.json({ ok: true });
}
