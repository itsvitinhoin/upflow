import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

async function assertCanEdit(projectId: string, fieldId: string, role: string) {
  if (role !== "admin") return { ok: false as const, status: 403 };
  const field = await prisma.customFieldDefinition.findUnique({
    where: { id: fieldId },
    select: { project_id: true },
  });
  if (!field || field.project_id !== projectId) {
    return { ok: false as const, status: 404 };
  }
  return { ok: true as const };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; fieldId: string } },
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await assertCanEdit(params.id, params.fieldId, auth.prismaUser.role);
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
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await assertCanEdit(params.id, params.fieldId, auth.prismaUser.role);
  if (!guard.ok) {
    const message = guard.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: guard.status });
  }

  await prisma.customFieldDefinition.delete({ where: { id: params.fieldId } });
  return NextResponse.json({ ok: true });
}
