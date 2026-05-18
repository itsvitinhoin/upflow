import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isWorkspaceAdmin } from "@/lib/auth-helpers";
import { requireAuth } from "@/lib/auth-response";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { inviteEmail } from "@/lib/email/templates";
import { getEmailOrigin, EmailOriginError } from "@/lib/email/origin";
import { logError } from "@/lib/log-error";

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

// GET: list pending invites for the active workspace (admin only)
export async function GET() {
  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const invites = await prisma.workspaceInvite.findMany({
    where: { workspace_id: auth.currentWorkspaceId, accepted_at: null },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      token: true,
      created_at: true,
      inviter: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json(invites);
}

// POST: create one invite per email and return tokens / accept links.
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, { windowMs: 60_000, max: 20, key: "invite" });
  if (!rl.ok) return rateLimitResponse(rl);

  const _r = await requireAuth();
  if (!_r.ok) return _r.response;
  const auth = _r.auth;
  if (!isWorkspaceAdmin(auth) || !auth.currentWorkspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    emails?: string[];
    role?: "admin" | "member";
  };
  const emails = (body.emails || [])
    .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
    .filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json(
      { error: "At least one email is required" },
      { status: 400 },
    );
  }
  if (emails.length > 50) {
    return NextResponse.json(
      { error: "Too many invites in one request" },
      { status: 400 },
    );
  }
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const invalid = emails.find((e) => !re.test(e));
  if (invalid) {
    return NextResponse.json(
      { error: `Invalid email: ${invalid}` },
      { status: 400 },
    );
  }
  const role: "admin" | "member" = body.role === "admin" ? "admin" : "member";

  // De-duplicate.
  const unique = Array.from(new Set(emails));

  // If APP_URL is missing in production we still create the invite
  // tokens — admins can paste them once the config is fixed — but we
  // skip the email send so we never build a recovery URL from a
  // potentially-poisoned Host header.
  let origin: string | null = null;
  try {
    origin = getEmailOrigin(req);
  } catch (err) {
    if (err instanceof EmailOriginError) {
      logError("invites:create:origin", err);
    } else {
      throw err;
    }
  }

  // Pull workspace name once for the email body.
  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.currentWorkspaceId },
    select: { name: true },
  });
  const inviterName = auth.prismaUser.name || auth.prismaUser.email;
  const inviterEmail = auth.prismaUser.email;

  // Reuse an existing pending invite (workspace_id + email + role) so admins
  // calling this endpoint twice with the same address don't generate a pile
  // of dead tokens. If only the role differs we still create a fresh invite.
  const created = await Promise.all(
    unique.map(async (email) => {
      const existing = await prisma.workspaceInvite.findFirst({
        where: {
          workspace_id: auth.currentWorkspaceId!,
          email,
          role,
          accepted_at: null,
        },
        select: { id: true, email: true, role: true, token: true, created_at: true },
      });
      const invite =
        existing ??
        (await prisma.workspaceInvite.create({
          data: {
            workspace_id: auth.currentWorkspaceId!,
            email,
            role,
            token: generateToken(),
            invited_by: auth.prismaUser.id,
          },
          select: { id: true, email: true, role: true, token: true, created_at: true },
        }));
      return {
        ...invite,
        // When origin is unavailable in production we fall back to a
        // path-only accept URL; admins can prepend the canonical host.
        accept_url: `${origin ?? ""}/invite/${invite.token}`,
        reused: existing !== null,
      };
    }),
  );

  // Send the invite emails. Failures are logged but don't fail the request
  // — admins can still copy the accept link from the response payload.
  // If origin is null (APP_URL missing in production) we skip the send
  // entirely so we never email a fabricated URL.
  let mailed = 0;
  if (origin === null) {
    return NextResponse.json(
      { success: true, sent: created.length, mailed: 0, invites: created },
      { status: 201 },
    );
  }
  await Promise.all(
    created.map(async (invite) => {
      const rendered = inviteEmail({
        workspaceName: workspace?.name ?? "your team",
        inviterName,
        inviterEmail,
        acceptUrl: invite.accept_url,
        role: invite.role === "admin" ? "admin" : "member",
      });
      const result = await sendEmail({
        to: invite.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: inviterEmail,
        scope: "invites:send",
      });
      if (result.ok) mailed += 1;
      else logError("invites:send", new Error(result.error ?? "unknown"), { email: invite.email });
    }),
  );

  return NextResponse.json(
    { success: true, sent: created.length, mailed, invites: created },
    { status: 201 },
  );
}
