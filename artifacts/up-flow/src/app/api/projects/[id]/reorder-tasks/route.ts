import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canAccessWorkspace,
  isWorkspaceAdminFor,
} from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { withErrorReporting } from "@/lib/with-error-reporting";
import {
  getOnboardingTaskStartBlocker,
  getOnboardingTaskCompletionBlocker,
  loadOnboardingAccess,
  syncOnboardingChecklistFromTaskStatus,
} from "@/lib/onboarding";

type ColumnKey = "todo" | "in_progress" | "done";
const VALID_COLUMNS: ColumnKey[] = ["todo", "in_progress", "done"];

function isColumn(value: unknown): value is ColumnKey {
  return typeof value === "string" && VALID_COLUMNS.includes(value as ColumnKey);
}

async function POST_handler(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, workspace_id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const isWorkspaceAdmin = isWorkspaceAdminFor(auth, project.workspace_id);

  const body = (await req.json()) as {
    movedTaskId?: string;
    srcColumn?: string;
    dstColumn?: string;
    dstIndex?: number;
  };

  const { movedTaskId, srcColumn, dstColumn, dstIndex } = body;
  if (
    typeof movedTaskId !== "string" ||
    !isColumn(srcColumn) ||
    !isColumn(dstColumn) ||
    typeof dstIndex !== "number" ||
    dstIndex < 0 ||
    !Number.isInteger(dstIndex)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const movedTask = await prisma.task.findUnique({
    where: { id: movedTaskId },
    select: { id: true, project_id: true, status: true },
  });
  if (!movedTask) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (movedTask.project_id !== params.id) {
    return NextResponse.json(
      { error: "Task does not belong to this project" },
      { status: 400 },
    );
  }
  if (movedTask.status !== srcColumn) {
    return NextResponse.json(
      { error: "Source column does not match task's current status" },
      { status: 409 },
    );
  }

  const onboardingItem = await prisma.onboardingChecklistItem.findFirst({
    where: { task_id: movedTaskId },
    select: { id: true, onboarding_id: true, department: true, owner_id: true, title: true },
  });
  const onboardingAccess = onboardingItem ? await loadOnboardingAccess(auth, onboardingItem.onboarding_id) : null;
  const canMoveDepartmentOnboardingTask = Boolean(
    onboardingItem && onboardingAccess?.canUpdateChecklistItem(onboardingItem) && srcColumn !== dstColumn,
  );
  if (!isWorkspaceAdmin && !canMoveDepartmentOnboardingTask) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (dstColumn === "done" && dstColumn !== srcColumn) {
    const blocker = await getOnboardingTaskCompletionBlocker(prisma, movedTaskId);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  }
  if (dstColumn === "in_progress" && dstColumn !== srcColumn) {
    const blocker = await getOnboardingTaskStartBlocker(prisma, movedTaskId);
    if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  }

  const affectedColumns: ColumnKey[] =
    srcColumn === dstColumn ? [srcColumn] : [srcColumn, dstColumn];

  const tasksInColumns = await prisma.task.findMany({
    where: { project_id: params.id, status: { in: affectedColumns } },
    select: { id: true, status: true, position: true },
    orderBy: [{ status: "asc" }, { position: "asc" }, { id: "asc" }],
  });

  const grouped: Record<ColumnKey, string[]> = {
    todo: [],
    in_progress: [],
    done: [],
  };
  for (const t of tasksInColumns) {
    if (isColumn(t.status)) grouped[t.status].push(t.id);
  }

  const srcOrdered = grouped[srcColumn].filter((id) => id !== movedTaskId);
  const dstOrdered = srcColumn === dstColumn ? srcOrdered : [...grouped[dstColumn]];
  const insertAt = Math.min(dstIndex, dstOrdered.length);
  dstOrdered.splice(insertAt, 0, movedTaskId);

  const finalLayout: Partial<Record<ColumnKey, string[]>> = {
    [dstColumn]: dstOrdered,
  };
  if (srcColumn !== dstColumn) {
    finalLayout[srcColumn] = srcOrdered;
  }

  const updates: { id: string; status: ColumnKey; position: number }[] = [];
  for (const col of affectedColumns) {
    const ids = finalLayout[col] ?? [];
    ids.forEach((id, index) => {
      updates.push({ id, status: col, position: index });
    });
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.task.update({
        where: { id: u.id },
        data: { status: u.status, position: u.position },
      }),
    ),
  );

  const onboardingSync =
    srcColumn !== dstColumn
      ? await syncOnboardingChecklistFromTaskStatus(prisma, {
          taskId: movedTaskId,
          status: dstColumn,
          actorId: auth.prismaUser.id,
        })
      : null;

  return NextResponse.json({ success: true, count: updates.length, onboarding_sync: onboardingSync });
}
export const POST = withErrorReporting("api:projects/id/reorder-tasks:POST", POST_handler);
