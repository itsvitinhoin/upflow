import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { canContributeToProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { createTaskAssetReference } from "@/lib/task-images";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { withErrorReporting } from "@/lib/with-error-reporting";

const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const BUCKET = process.env.TASK_ASSETS_BUCKET || "task-assets";

type ReferenceType = "image/png" | "image/jpeg" | "application/pdf";
type RouteContext = { params: Promise<{ id: string }> };

function typeFromBytes(bytes: Buffer): ReferenceType | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

function extensionFor(type: ReferenceType) {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  return "pdf";
}

function safeFileName(value: string) {
  const name = value.replace(/[\r\n]/g, " ").trim();
  return (name || "creative-reference").slice(0, 160);
}

async function POST_handler(
  req: NextRequest,
  { params }: RouteContext,
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      project: { select: { id: true, workspace_id: true, owner_id: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!(await canContributeToProject(auth, task.project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return NextResponse.json(
      { error: "Creative reference storage is not configured", code: "TASK_STORAGE_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const assetRoleValue = form?.get("asset_role");
  if (
    assetRoleValue !== null &&
    assetRoleValue !== undefined &&
    assetRoleValue !== "reference" &&
    assetRoleValue !== "drive_file"
  ) {
    return NextResponse.json({ error: "Invalid creative asset role" }, { status: 400 });
  }
  const assetRole = assetRoleValue === "drive_file" ? "drive_file" : "reference";
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Reference file is required" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_REFERENCE_BYTES) {
    return NextResponse.json(
      { error: "Reference file must be between 1 byte and 20 MB" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = typeFromBytes(bytes);
  if (!contentType) {
    return NextResponse.json(
      { error: "Upload a real JPG, PNG, or PDF file" },
      { status: 400 },
    );
  }

  const path = [
    task.project.workspace_id,
    task.id,
    `${Date.now()}-${randomUUID()}.${extensionFor(contentType)}`,
  ].join("/");
  const reference = createTaskAssetReference(path);
  if (!reference) throw new Error("generated creative reference path failed validation");

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    return NextResponse.json(
      {
        error: "Could not upload the creative reference. Confirm the private task assets bucket exists.",
        code: "CREATIVE_REFERENCE_UPLOAD_FAILED",
      },
      { status: 503 },
    );
  }

  if (contentType !== "application/pdf" && assetRole !== "drive_file") {
    await prisma.task.update({
      where: { id: task.id },
      data: { cover_image_url: reference },
    });
  }

  return NextResponse.json({
    reference,
    file_name: safeFileName(file.name),
    asset_role: assetRole,
    cover_image_url: contentType === "application/pdf" || assetRole === "drive_file" ? null : reference,
  });
}

export const POST = withErrorReporting("api:tasks/id:creative-reference:POST", POST_handler);
