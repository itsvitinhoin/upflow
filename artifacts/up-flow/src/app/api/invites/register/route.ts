import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOwnedWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { isPhoneLikeName, normalizeDisplayName, normalizePhone } from "@/lib/user-profile";

async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, {
    windowMs: 60_000,
    max: 8,
    key: "invite-register",
  });
  if (!rl.ok) return rateLimitResponse(rl);

  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    email?: string;
    full_name?: string;
    password?: string;
    phone?: string;
  };
  const token = body.token?.trim();
  const submittedEmail = body.email?.trim().toLowerCase();
  const rawFullName = body.full_name?.trim();
  const phone = normalizePhone(body.phone);
  const password = body.password ?? "";

  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });
  if (!submittedEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!rawFullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (isPhoneLikeName(rawFullName)) {
    return NextResponse.json(
      { error: "Full name must be your name, not your cellphone number" },
      { status: 400 },
    );
  }
  if (!phone) {
    return NextResponse.json({ error: "Cellphone number is required" }, { status: 400 });
  }
  const fullName = normalizeDisplayName(rawFullName, submittedEmail, phone);
  if (fullName.replace(/\D/g, "") === phone.replace(/\D/g, "")) {
    return NextResponse.json(
      { error: "Full name must be different from cellphone number" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      accepted_at: true,
      workspace_id: true,
      tester_invite: true,
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.accepted_at) {
    return NextResponse.json({ error: "Invite already used" }, { status: 410 });
  }

  const email = invite.email.toLowerCase();
  if (submittedEmail !== email) {
    return NextResponse.json(
      { error: `This invite is for ${invite.email}. Use that email to create the account.` },
      { status: 403 },
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "An account already exists for this email. Sign in to accept the invite.",
        code: "ACCOUNT_EXISTS",
      },
      { status: 409 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured: invite account creation is unavailable" },
      { status: 500 },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: fullName, full_name: fullName, phone },
  });

  if (createError) {
    const message = createError.message.toLowerCase();
    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists")
    ) {
      return NextResponse.json(
        {
          error:
            "An account already exists for this email. Sign in to accept the invite.",
          code: "ACCOUNT_EXISTS",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  let createdUserId = "";
  const testerWorkspace = invite.workspace;
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: fullName, phone, role: "member" },
      select: { id: true },
    });
    createdUserId = user.id;

    if (invite.tester_invite) {
      await tx.workspaceMember.upsert({
        where: {
          workspace_id_user_id: {
            workspace_id: invite.workspace_id,
            user_id: user.id,
          },
        },
        create: {
          workspace_id: invite.workspace_id,
          user_id: user.id,
          role: invite.role,
        },
        update: { role: invite.role, status: "active" },
      });
    }

    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { accepted_at: new Date(), accepted_by: user.id },
    });
  });

  const targetWorkspace = invite.tester_invite
    ? testerWorkspace
    : await ensureOwnedWorkspace(createdUserId, fullName);

  const supabase = createSupabaseServerClient();
  const { data: sessionData, error: sessionError } =
    await supabase.auth.signInWithPassword({ email, password });
  if (sessionError || !sessionData.session) {
    return NextResponse.json(
      {
        error:
          "Account created, but automatic sign-in failed. Please sign in with your new password.",
        code: "SIGN_IN_REQUIRED",
      },
      { status: 202 },
    );
  }

  const res = NextResponse.json({
    success: true,
    workspace_id: targetWorkspace.id,
    workspace: targetWorkspace,
    source_workspace_id: invite.workspace_id,
  });
  res.cookies.set(WORKSPACE_COOKIE, targetWorkspace.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export const POST = withErrorReporting("api:invites/register:POST", POST_handler);
