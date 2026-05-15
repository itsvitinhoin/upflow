import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser, canAccessWorkspace } from "@/lib/auth-helpers";
import { isEmptyValue, validateCustomFieldValue } from "@/lib/custom-field-validator";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      project_id: true,
      project: { select: { workspace_id: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, task.project.workspace_id)) {
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
    select: { project_id: true, name: true, type: true, options: true },
  });
  if (!def || def.project_id !== task.project_id) {
    return NextResponse.json({ error: "Field not in this project" }, { status: 400 });
  }

  if (isEmptyValue(body.value)) {
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

  const validated = validateCustomFieldValue(def, body.value);
  if (!validated.ok) {
    return NextResponse.json(
      { error: `Invalid value for "${def.name}": ${validated.error}` },
      { status: 400 },
    );
  }

  const upserted = await prisma.customFieldValue.upsert({
    where: {
      task_id_definition_id: {
        task_id: task.id,
        definition_id: body.definition_id,
      },
    },
    update: { value: validated.value as Prisma.InputJsonValue },
    create: {
      task_id: task.id,
      definition_id: body.definition_id,
      value: validated.value as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(upserted);
}
