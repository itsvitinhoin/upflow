import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { prisma } from "@/lib/prisma";
import { canContributeToProject } from "@/lib/project-access";
import { createTaskAssetReference } from "@/lib/task-images";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { withErrorReporting } from "@/lib/with-error-reporting";

const MAX_IMAGE_BYTES = 2_000_000;
const BUCKET = process.env.TASK_ASSETS_BUCKET || "task-assets";

type ImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formUuid(form: FormData, field: string): string | null | "invalid" {
  const value = form.get(field);
  if (value === null) return null;
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : "invalid";
}

function imageTypeFromBytes(bytes: Buffer): ImageType | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  const gifHeader = bytes.subarray(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") return "image/gif";
  return null;
}

function extensionFor(type: ImageType) {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
  }
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid upload form" }, { status: 400 });
  }

  const projectId = formUuid(form, "project_id");
  const taskId = formUuid(form, "task_id");
  if (projectId === "invalid" || taskId === "invalid") {
    return NextResponse.json({ error: "Invalid project or task" }, { status: 400 });
  }
  if (!projectId && !taskId) {
    return NextResponse.json({ error: "Project or task is required" }, { status: 400 });
  }

  let project: { id: string; workspace_id: string; owner_id: string };
  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        project: { select: { id: true, workspace_id: true, owner_id: true } },
      },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (projectId && task.project.id !== projectId) {
      return NextResponse.json({ error: "Task does not belong to project" }, { status: 400 });
    }
    project = task.project;
  } else {
    const foundProject = await prisma.project.findUnique({
      where: { id: projectId! },
      select: { id: true, workspace_id: true, owner_id: true },
    });
    if (!foundProject) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    project = foundProject;
  }

  const canUpload =
    isWorkspaceAdminFor(auth, project.workspace_id) ||
    (await canContributeToProject(auth, project));
  if (!canUpload) {
    return NextResponse.json({ error: "Project contributor access required" }, { status: 403 });
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return NextResponse.json(
      {
        error: "Task image storage is not configured. Add Supabase URL, service role key, and a private task assets bucket.",
        code: "TASK_STORAGE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Use an image under 2 MB." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const imageType = imageTypeFromBytes(bytes);
  if (!imageType) {
    return NextResponse.json(
      { error: "Upload a real PNG, JPG, WebP, or GIF image." },
      { status: 400 },
    );
  }

  const path = [
    project.workspace_id,
    auth.prismaUser.id,
    `${Date.now()}-${randomUUID()}.${extensionFor(imageType)}`,
  ].join("/");
  const reference = createTaskAssetReference(path);
  if (!reference) throw new Error("generated task asset path failed validation");

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: imageType,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not upload task cover image. Confirm the private Supabase Storage bucket exists and accepts uploads.",
        code: "TASK_COVER_UPLOAD_FAILED",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ reference, path });
}

export const POST = withErrorReporting("api:uploads/task-cover:POST", POST_handler);
