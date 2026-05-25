import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { isWorkspaceAdmin, isWorkspaceAdminFor } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { ensureTesterWorkspace } from "@/lib/tester-workspace";

// Workspace-admin-only direct provisioning. Creates the auth user in
// Supabase and adds them as a member of the caller's active workspace.
async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, { windowMs: 60_000, max: 10, key: "register" });
  if (!rl.ok) return rateLimitResponse(rl);

  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    workspace_id?: string;
    role?: "admin" | "member";
    tester_account?: boolean;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const name = body.name?.trim() || (email ? email.split("@")[0] : undefined);
  const phone = body.phone?.trim() || null;
  const role = body.role === "admin" && !body.tester_account ? "admin" : "member";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password is required (minimum 8 characters)" },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 500 },
    );
  }

  let targetWorkspaceId = auth.currentWorkspaceId;
  let targetWorkspace: { id: string; name: string; slug: string } | null = null;
  if (body.tester_account) {
    targetWorkspace = await ensureTesterWorkspace(auth.prismaUser.id);
    targetWorkspaceId = targetWorkspace.id;
  } else if (body.workspace_id?.trim()) {
    targetWorkspaceId = body.workspace_id.trim();
  }

  if (!isWorkspaceAdminFor(auth, targetWorkspaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!targetWorkspace) {
    targetWorkspace = await prisma.workspace.findUnique({
      where: { id: targetWorkspaceId },
      select: { id: true, name: true, slug: true },
    });
  }

  const acceptedResponse = (status = 202, existing = false) =>
    NextResponse.json(
      {
        status: "accepted",
        existing,
        workspace: targetWorkspace,
        user: { email, name, role },
      },
      { status },
    );

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    // If the user already exists in Prisma, attach them to this workspace
    // if not already a member, then return neutral.
    await prisma.workspaceMember
      .upsert({
        where: {
          workspace_id_user_id: {
            workspace_id: targetWorkspaceId,
            user_id: existing.id,
          },
        },
        create: {
          workspace_id: targetWorkspaceId,
          user_id: existing.id,
          role,
        },
        update: { role, status: "active" },
      })
      .catch((err) => {
        logError("users:register:wsm-upsert", err, { user_id: existing.id });
      });
    return acceptedResponse(202, true);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error: supabaseErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, full_name: name, phone },
  });
  if (supabaseErr) {
    const msg = supabaseErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      const user = await prisma.user.upsert({
        where: { email },
        create: { email, name: name ?? email.split("@")[0], phone, role: "member" },
        update: { name: name ?? email.split("@")[0], phone },
        select: { id: true },
      });
      await prisma.workspaceMember.upsert({
        where: {
          workspace_id_user_id: {
            workspace_id: targetWorkspaceId,
            user_id: user.id,
          },
        },
        create: { workspace_id: targetWorkspaceId, user_id: user.id, role },
        update: { role, status: "active" },
      });
      return acceptedResponse(202, true);
    }
    return NextResponse.json({ error: supabaseErr.message }, { status: 400 });
  }

  const created = await prisma.user.create({
    data: { email, name: name ?? email.split("@")[0], phone, role: "member" },
    select: { id: true },
  });

  await prisma.workspaceMember
    .create({
      data: {
        workspace_id: targetWorkspaceId,
        user_id: created.id,
        role,
      },
    })
    .catch((err) => {
      logError("users:register:wsm-create", err, { user_id: created.id });
    });

  return acceptedResponse(201, false);
}
export const POST = withErrorReporting("api:users/register:POST", POST_handler);
