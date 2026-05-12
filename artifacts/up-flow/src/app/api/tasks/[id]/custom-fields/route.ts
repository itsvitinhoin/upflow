import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-helpers";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prismaUser } = auth;

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: { project: { select: { owner_id: true } } },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isProjectOwner = task.project.owner_id === prismaUser.id;
  const isAssignee = task.assignee_id === prismaUser.id;
  if (!isProjectOwner && !isAssignee && prismaUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    definition_id?: string;
    value?: unknown;
  };
  if (!body.definition_id) {
    return NextResponse.json({ error: "definition_id is required" }, { status: 400 });
  }

  const def = await prisma.customFieldDefinition.findUnique({
    where: { id: body.definition_id },
    select: { project_id: true },
  });
  if (!def || def.project_id !== task.project_id) {
    return NextResponse.json({ error: "Field not in this project" }, { status: 400 });
  }

  const isEmpty =
    body.value === null ||
    body.value === undefined ||
    body.value === "" ||
    (Array.isArray(body.value) && body.value.length === 0);

  if (isEmpty) {
    await prisma.customFieldValue
      .delete({
        where: {
          task_id_definition_id: {
            task_id: task.id,
            definition_id: body.definition_id,
          },
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, value: null });
  }

  const upserted = await prisma.customFieldValue.upsert({
    where: {
      task_id_definition_id: {
        task_id: task.id,
        definition_id: body.definition_id,
      },
    },
    update: { value: body.value as never },
    create: {
      task_id: task.id,
      definition_id: body.definition_id,
      value: body.value as never,
    },
  });

  return NextResponse.json(upserted);
}
