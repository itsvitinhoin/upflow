import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-response";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { withErrorReporting } from "@/lib/with-error-reporting";

const MAX_IMAGE_BYTES = 2_000_000;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const BUCKET = process.env.TASK_ASSETS_BUCKET || "task-assets";

function extensionFor(type: string) {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

async function POST_handler(req: NextRequest) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  if (!auth.currentWorkspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "Task image storage is not configured. Add Supabase URL, service role key, and a public task assets bucket.",
        code: "TASK_STORAGE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Upload a PNG, JPG, WebP, or GIF image" },
      { status: 400 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Use an image under 2 MB." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = [
    auth.currentWorkspaceId,
    auth.prismaUser.id,
    `${Date.now()}-${randomUUID()}.${extensionFor(file.type)}`,
  ].join("/");

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    return NextResponse.json(
      {
        error:
          "Could not upload task cover image. Confirm the Supabase Storage bucket exists and accepts uploads.",
        code: "TASK_COVER_UPLOAD_FAILED",
      },
      { status: 503 },
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    return NextResponse.json(
      { error: "Image uploaded, but no public URL was returned." },
      { status: 503 },
    );
  }

  return NextResponse.json({ url: data.publicUrl, path });
}

export const POST = withErrorReporting("api:uploads/task-cover:POST", POST_handler);
