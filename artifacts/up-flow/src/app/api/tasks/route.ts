import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthUser,
  canAccessWorkspace,
  isSuperAdmin,
} from "@/lib/auth-helpers";
import { broadcastNotification } from "@/lib/supabase-server";
import { Prisma, type TaskStatus, type TaskPriority } from "@prisma/client";

function parseDueDate(input: unknown): Date | null | "invalid" {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "string") return "invalid";
  const d = new Date(input);
  return isNaN(d.getTime()) ? "invalid" : d;
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const mine = searchParams.get("mine") === "true";
  const parentId = searchParams.get("parent_id");

  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspace_id: true },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canAccessWorkspace(auth, project.workspace_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const where: Prisma.TaskWhereInput = {};
  if (projectId) where.project_id = projectId;
  if (mine) where.assignee_id = auth.prismaUser.id;
  if (parentId) where.parent_id = parentId;

  // If no projectId filter, scope to the active workspace so the UI stays
  // consistent with the workspace switcher. Super-admins also see only the
  // active workspace here on purpose.
  if (!projectId) {
    if (!auth.currentWorkspaceId) {
      return NextResponse.json([], { status: 200 });
    }
    where.project = { workspace_id: auth.currentWorkspaceId };
  }
  // Silence unused-import lint when isSuperAdmin isn't referenced.
  void isSuperAdmin;

  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get("limit") || "500", 10) || 500),
    1000
  );
  const cursor = searchParams.get("cursor");

  const tasks = await prisma.task.findMany({
    where,
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: [{ position: "asc" }, { created_at: "desc" }, { id: "asc" }],
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      custom_field_values: {
        select: { definition_id: true, value: true },
      },
      _count: { select: { comments: true, subtasks: true } },
    },
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    project_id?: string;
    assignee_id?: string;
    due_date?: string;
    parent_id?: string;
    custom_fields?: Array<{ definition_id: string; value: unknown }>;
  };

  const { title, description, status, priority, project_id, assignee_id, parent_id, custom_fields } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!project_id) return NextResponse.json({ error: "project_id is required" }, { status: 400 });

  if (custom_fields !== undefined && !Array.isArray(custom_fields)) {
    return NextResponse.json(
      { error: "custom_fields must be an array of { definition_id, value }" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: project_id },
    select: { id: true, workspace_id: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!canAccessWorkspace(auth, project.workspace_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (assignee_id) {
    // Assignee must be a member of the project's workspace.
    const ok = await prisma.workspaceMember.findFirst({
      where: { workspace_id: project.workspace_id, user_id: assignee_id },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Assignee is not a member of this workspace" },
        { status: 400 },
      );
    }
  }

  const dueDate = parseDueDate(body.due_date);
  if (dueDate === "invalid") {
    return NextResponse.json({ error: "Invalid due_date" }, { status: 400 });
  }

  if (parent_id) {
    const parent = await prisma.task.findUnique({
      where: { id: parent_id },
      select: { project_id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }
    if (parent.project_id !== project_id) {
      return NextResponse.json(
        { error: "Subtask must be in the same project as its parent" },
        { status: 400 }
      );
    }
  }

  const userId = auth.prismaUser.id;

  const lastTask = await prisma.task.findFirst({
    where: { project_id, status: status ?? "todo" },
    orderBy: { position: "desc" },
  });
  const position = (lastTask?.position ?? -1) + 1;

  const cfEntries = (custom_fields ?? []).filter(
    (e) => e && e.definition_id && e.value !== undefined && e.value !== "" && e.value !== null
  );

  if (cfEntries.length > 0) {
    const defs = await prisma.customFieldDefinition.findMany({
      where: { id: { in: cfEntries.map((e) => e.definition_id) } },
      select: { id: true, project_id: true },
    });
    if (defs.length !== cfEntries.length || defs.some((d) => d.project_id !== project_id)) {
      return NextResponse.json(
        { error: "Invalid custom field for this project" },
        { status: 400 }
      );
    }
  }

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        status: status ?? "todo",
        priority: priority ?? "medium",
        project_id,
        assignee_id: assignee_id || null,
        due_date: dueDate,
        parent_id: parent_id || null,
        position,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (cfEntries.length > 0) {
      await tx.customFieldValue.createMany({
        data: cfEntries.map((e) => ({
          task_id: created.id,
          definition_id: e.definition_id,
          value: e.value as Prisma.InputJsonValue,
        })),
      });
    }

    return created;
  });

  if (assignee_id && assignee_id !== userId) {
    await prisma.notification
      .create({ data: { type: "assigned", user_id: assignee_id, task_id: task.id } })
      .catch(() => {});
    await broadcastNotification(assignee_id);
  }

  return NextResponse.json(task, { status: 201 });
}
