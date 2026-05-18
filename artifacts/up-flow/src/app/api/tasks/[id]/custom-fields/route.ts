import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { isEmptyValue, validateCustomFieldValue } from "@/lib/custom-field-validator";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";

async function PUT_handler(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

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
      .catch((err) => {
        // P2025 (row not found) is expected when clearing an already-empty
        // field; only log unexpected errors.
        const code = (err as { code?: string })?.code;
        if (code !== "P2025") logError("api:custom-fields:delete", err, { task_id: task.id });
      });
    return NextResponse.json({ ok: true, value: null });
  }

  const validated = validateCustomFieldValue(def, body.value);
  if (!validated.ok) {
    return NextResponse.json(
      { error: `Invalid value for "${def.name}": ${validated.error}` },
      { status: 400 },
    );
  }

  // People-type fields: ensure every referenced id is a workspace member.
  if (def.type === "people" && Array.isArray(validated.value)) {
    const ids = (validated.value as string[]).filter((s) => typeof s === "string");
    if (ids.length > 0) {
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspace_id: task.project.workspace_id,
          user_id: { in: ids },
        },
        select: { user_id: true },
      });
      const memberSet = new Set(members.map((m) => m.user_id));
      const bad = ids.find((id) => !memberSet.has(id));
      if (bad) {
        return NextResponse.json(
          {
            error: `Invalid value for "${def.name}": user ${bad} is not a member of this workspace`,
          },
          { status: 400 },
        );
      }
    }
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
export const PUT = withErrorReporting("api:tasks/id/custom-fields:PUT", PUT_handler);
