import { NextRequest, NextResponse } from "next/server";
import { canAccessWorkspace } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { canReadProject } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { createTaskAssetReference } from "@/lib/task-images";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { withErrorReporting } from "@/lib/with-error-reporting";

const BUCKET = process.env.TASK_ASSETS_BUCKET || "task-assets";

async function GET_handler(
  _req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;

  const path = params.path.join("/");
  const reference = createTaskAssetReference(path);
  const workspaceId = params.path[0];
  if (!reference || !workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessWorkspace(auth, workspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Existing task covers are readable by workspace members. A freshly
  // uploaded, not-yet-saved asset can only be previewed by its uploader.
  const [task, uploadedByCaller] = await Promise.all([
    prisma.task.findFirst({
      where: {
        project: { workspace_id: workspaceId },
        OR: [
          { cover_image_url: reference },
          { description: { contains: reference } },
        ],
      },
      select: {
        id: true,
        project: { select: { id: true, workspace_id: true, owner_id: true } },
      },
    }),
    Promise.resolve(params.path[1] === auth.prismaUser.id),
  ]);
  if (task && !(await canReadProject(auth, task.project))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!task && !uploadedByCaller) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Task image is temporarily unavailable" }, { status: 503 });
  }
  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const dynamic = "force-dynamic";
export const GET = withErrorReporting("api:task-assets:GET", GET_handler);
