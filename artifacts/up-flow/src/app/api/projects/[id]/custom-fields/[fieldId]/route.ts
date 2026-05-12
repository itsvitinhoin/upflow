import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

async function assertCanEdit(
  projectId: string,
  fieldId: string,
  userId: string,
  role: string,
) {
  const [project, field] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { owner_id: true },
    }),
    prisma.customFieldDefinition.findUnique({
      where: { id: fieldId },
      select: { project_id: true },
    }),
  ]);
  if (!project || !field) return { ok: false as const, status: 404 };
  if (field.project_id !== projectId) return { ok: false as const, status: 404 };
  if (project.owner_id !== userId && role !== "admin") {
    return { ok: false as const, status: 403 };
  }
  return { ok: true as const };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; fieldId: string } },
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await assertCanEdit(
    params.id,
    params.fieldId,
    auth.prismaUser.id,
    auth.prismaUser.role,
  );
  if (!guard.ok) return NextResponse.json({ error: "Not found" }, { status: guard.status });

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
        options: (Array.isArray(body.options) ? body.options : null) as never,
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

  const guard = await assertCanEdit(
    params.id,
    params.fieldId,
    auth.prismaUser.id,
    auth.prismaUser.role,
  );
  if (!guard.ok) return NextResponse.json({ error: "Not found" }, { status: guard.status });

  await prisma.customFieldDefinition.delete({ where: { id: params.fieldId } });
  return NextResponse.json({ ok: true });
}
