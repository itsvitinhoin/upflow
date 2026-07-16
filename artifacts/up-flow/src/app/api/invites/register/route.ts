import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOwnedWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";
import { hashInviteToken, isInviteExpired } from "@/lib/invite-token";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { logError } from "@/lib/log-error";
import { withErrorReporting } from "@/lib/with-error-reporting";
import { isPhoneLikeName, normalizeDisplayName, normalizePhone } from "@/lib/user-profile";

function invalidInvite(status = 404) {
  return NextResponse.json({ error: "This invite is no longer valid" }, { status });
}

function expiredInvite() {
  return NextResponse.json(
    { error: "Invite expired. Ask an administrator to send a new one." },
    { status: 410 },
  );
}

async function POST_handler(req: NextRequest) {
  const rl = await checkRateLimit(req, {
    windowMs: 60_000,
    max: 8,
    key: "invite-register",
    requireSharedStore: true,
  });
  if (!rl.ok) return rateLimitResponse(rl);

  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    email?: string;
    full_name?: string;
    password?: string;
    phone?: string;
  };
  const tokenHash = hashInviteToken(body.token);
  const submittedEmail = body.email?.trim().toLowerCase();
  const rawFullName = body.full_name?.trim();
  const phone = normalizePhone(body.phone);
  const password = body.password ?? "";

  if (!tokenHash) return invalidInvite();
  if (!submittedEmail) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!rawFullName) return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  if (isPhoneLikeName(rawFullName)) {
    return NextResponse.json(
      { error: "Full name must be your name, not your cellphone number" },
      { status: 400 },
    );
  }
  if (!phone) return NextResponse.json({ error: "Cellphone number is required" }, { status: 400 });
  const fullName = normalizeDisplayName(rawFullName, submittedEmail, phone);
  if (fullName.replace(/\D/g, "") === phone.replace(/\D/g, "")) {
    return NextResponse.json(
      { error: "Full name must be different from cellphone number" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token_hash: tokenHash },
    select: {
      id: true,
      email: true,
      role: true,
      accepted_at: true,
      expires_at: true,
      workspace_id: true,
      tester_invite: true,
      invite_mode: true,
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!invite) return invalidInvite();
  if (invite.accepted_at) return invalidInvite(410);
  if (isInviteExpired(invite.expires_at)) return expiredInvite();

  const email = invite.email.toLowerCase();
  if (submittedEmail !== email) {
    return NextResponse.json({ error: "This invite is no longer valid" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      {
        error: "An account already exists for this email. Sign in to accept the invite.",
        code: "ACCOUNT_EXISTS",
      },
      { status: 409 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    logError("invites:register:config", new Error("Supabase service credentials are missing"));
    return NextResponse.json({ error: "Account creation is temporarily unavailable" }, { status: 503 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: createdAuth, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: fullName, full_name: fullName, phone },
  });

  if (createError || !createdAuth.user) {
    const message = createError?.message.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return NextResponse.json(
        {
          error: "An account already exists for this email. Sign in to accept the invite.",
          code: "ACCOUNT_EXISTS",
        },
        { status: 409 },
      );
    }
    logError("invites:register:supabase", createError ?? new Error("missing auth user"));
    return NextResponse.json(
      { error: "Unable to create the account. Please verify the information and try again." },
      { status: 400 },
    );
  }

  let createdUserId = "";
  let joinsSourceWorkspace = false;
  let sourceWorkspace = invite.workspace;
  try {
    await prisma.$transaction(async (tx) => {
      // Re-read the token inside the transaction to prevent replay during
      // account provisioning. The Supabase account is deleted below if this
      // transaction cannot commit.
      const fresh = await tx.workspaceInvite.findUnique({
        where: { token_hash: tokenHash },
        select: {
          id: true,
          email: true,
          role: true,
          accepted_at: true,
          expires_at: true,
          workspace_id: true,
          tester_invite: true,
          invite_mode: true,
          workspace: { select: { id: true, name: true, slug: true } },
        },
      });
      if (!fresh || fresh.accepted_at || isInviteExpired(fresh.expires_at)) {
        throw new Error("invite_unavailable");
      }
      if (fresh.email.toLowerCase() !== email) throw new Error("invite_unavailable");

      const user = await tx.user.create({
        data: { email, name: fullName, phone, role: "member" },
        select: { id: true },
      });
      createdUserId = user.id;

      // Conditional consumption prevents a replay from accepting the same
      // token after another registration wins the race. A failed claim rolls
      // back this Prisma user and triggers the Supabase cleanup below.
      const claimed = await tx.workspaceInvite.updateMany({
        where: {
          id: fresh.id,
          accepted_at: null,
          expires_at: { gt: new Date() },
        },
        data: { accepted_at: new Date(), accepted_by: user.id },
      });
      if (claimed.count !== 1) throw new Error("invite_unavailable");

      joinsSourceWorkspace =
        fresh.tester_invite || fresh.invite_mode === "workspace_access";
      sourceWorkspace = fresh.workspace;

      if (joinsSourceWorkspace) {
        await tx.workspaceMember.upsert({
          where: {
            workspace_id_user_id: {
              workspace_id: fresh.workspace_id,
              user_id: user.id,
            },
          },
          create: { workspace_id: fresh.workspace_id, user_id: user.id, role: fresh.role },
          update: { role: fresh.role, status: "active" },
        });
      }
    });
  } catch (error) {
    logError("invites:register:prisma", error, { invite_id: invite.id });
    await admin.auth.admin.deleteUser(createdAuth.user.id).catch((deleteError) => {
      logError("invites:register:auth-rollback", deleteError, { invite_id: invite.id });
    });
    return NextResponse.json(
      { error: "Account creation is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }

  const targetWorkspace = joinsSourceWorkspace
    ? sourceWorkspace
    : await ensureOwnedWorkspace(createdUserId, fullName);

  const supabase = await createSupabaseServerClient();
  const { data: sessionData, error: sessionError } =
    await supabase.auth.signInWithPassword({ email, password });
  if (sessionError || !sessionData.session) {
    return NextResponse.json(
      {
        error: "Account created, but automatic sign-in failed. Please sign in with your new password.",
        code: "SIGN_IN_REQUIRED",
      },
      { status: 202 },
    );
  }

  const response = NextResponse.json({
    success: true,
    workspace_id: targetWorkspace.id,
    workspace: targetWorkspace,
    source_workspace_id: invite.workspace_id,
  });
  response.cookies.set(WORKSPACE_COOKIE, targetWorkspace.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const POST = withErrorReporting("api:invites/register:POST", POST_handler);
