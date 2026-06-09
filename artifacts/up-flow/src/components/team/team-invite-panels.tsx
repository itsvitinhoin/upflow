"use client";

import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  MailCheck,
  RotateCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  EmailStatus,
  PendingInvite,
  TeamOverview,
  TesterWorkspace,
} from "@/components/team/team-page-types";

export function RealUserInvitePanel({
  workspace,
  memberCount,
  pendingCount,
  emailReady,
  onInvite,
}: {
  workspace: TeamOverview["workspace"];
  memberCount: number;
  pendingCount: number;
  emailReady: boolean | null;
  onInvite: () => void;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-primary/25 bg-[linear-gradient(135deg,rgba(124,92,255,0.14),rgba(16,185,129,0.07),rgba(255,255,255,0.03))] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <UserPlus className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-foreground">
              Invite real users to Up Flow
            </h3>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                emailReady
                  ? "bg-upflow-success/15 text-upflow-success"
                  : "bg-upflow-warning/15 text-upflow-warning",
              )}
            >
              {emailReady ? "Email ready" : "Check email setup"}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Send official invitations for two clear paths: users can get their
            own UP Flow workspace, or they can join {workspace?.name ?? "this workspace"}
            and appear here as team members after accepting.
          </p>
        </div>
        <button
          type="button"
          onClick={onInvite}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <MailCheck className="h-4 w-4" />
          Invite users
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <InviteStat label="Source workspace" value={workspace?.name ?? "Current workspace"} />
        <InviteStat label="Internal members" value={String(memberCount)} />
        <InviteStat label="Pending invites" value={String(pendingCount)} />
      </div>
    </section>
  );
}

export function EmailSetupWarning({
  status,
  emailTestStatus,
  testingEmail,
  onSendTest,
}: {
  status: EmailStatus;
  emailTestStatus: { ok: boolean; message: string; checkedAt: string } | null;
  testingEmail: boolean;
  onSendTest: () => void;
}) {
  const missing = [
    !status.app_url_configured && "APP_URL",
    !status.resend_api_key_configured && "RESEND_API_KEY",
    !status.email_from_configured && "EMAIL_FROM",
  ].filter(Boolean);
  const ready = status.ready;

  return (
    <div
      className={cn(
        "mb-4 rounded-xl border px-4 py-3",
        ready
          ? "border-upflow-success/30 bg-upflow-success/10"
          : "border-upflow-warning/30 bg-upflow-warning/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {ready ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-upflow-success" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-upflow-warning" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {ready ? "Invite email setup is ready" : "Invite email setup needs attention"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ready
                ? "APP_URL, RESEND_API_KEY, and EMAIL_FROM are configured with a non-development sender."
                : `${
                    missing.length > 0 ? `Missing: ${missing.join(", ")}. ` : ""
                  }${
                    status.using_development_sender
                      ? "Set EMAIL_FROM to a verified Resend sender. "
                      : ""
                  }Invites are blocked until Resend delivery is configured and accepted.`}
            </p>
            {emailTestStatus && (
              <p
                className={cn(
                  "mt-2 text-[11px]",
                  emailTestStatus.ok ? "text-upflow-success" : "text-upflow-danger",
                )}
              >
                Last test {emailTestStatus.checkedAt}: {emailTestStatus.message}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onSendTest}
          disabled={testingEmail}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-upflow-warning/30 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-upflow-warning/10 disabled:opacity-60"
        >
          <MailCheck className={cn("h-3.5 w-3.5", testingEmail && "animate-pulse")} />
          {testingEmail ? "Testing..." : "Send test"}
        </button>
      </div>
    </div>
  );
}

export function TesterInvitePanel({
  workspace,
  invites,
  settingUp,
  resending,
  canceling,
  onPrepare,
  onViewMembers,
  onInvite,
  onCreateAccount,
  onResend,
  onCancel,
  onReset,
  resetting,
}: {
  workspace: TesterWorkspace | null;
  invites: PendingInvite[];
  settingUp: boolean;
  resending: string | null;
  canceling: string | null;
  resetting: boolean;
  onPrepare: () => void;
  onViewMembers: () => void;
  onInvite: () => void;
  onCreateAccount: () => void;
  onResend: (invite: PendingInvite) => void;
  onCancel: (invite: PendingInvite) => void;
  onReset: (email?: string) => void;
}) {
  const pending = invites.filter((invite) => !invite.accepted_at);
  const accepted = invites.filter((invite) => invite.accepted_at);
  const failed = pending.filter((invite) => invite.send_status === "failed");

  return (
    <section className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Tester invite workspace
            </h3>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Invite outside testers into an isolated workspace with demo clients,
            tasks, meetings, docs, and activity. They will not see real Admin
            workspace data unless you invite them separately.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!workspace && (
            <button
              type="button"
              onClick={onPrepare}
              disabled={settingUp}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-60"
            >
              {settingUp ? "Preparing..." : "Prepare workspace"}
            </button>
          )}
          <button
            type="button"
            onClick={onCreateAccount}
            disabled={settingUp}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Create tester account
          </button>
          <button
            type="button"
            onClick={() => onReset("victorcheunin@gmail.com")}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 rounded-md border border-upflow-danger/40 px-3 py-1.5 text-xs font-medium text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {resetting ? "Resetting..." : "Reset tester"}
          </button>
          <button
            type="button"
            onClick={onInvite}
            disabled={settingUp}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-60"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Email invite
          </button>
          {workspace && (
            <button
              type="button"
              onClick={onViewMembers}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60"
            >
              <Users className="h-3.5 w-3.5" />
              View tester members
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <TesterStat label="Workspace" value={workspace?.name ?? "Not prepared"} />
        <TesterStat label="Pending" value={String(pending.length)} />
        <TesterStat label="Accepted" value={String(accepted.length)} />
        <TesterStat label="Needs resend" value={String(failed.length)} />
      </div>

      {workspace && invites.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          <ul className="divide-y divide-border">
            {invites.map((invite) => {
              const acceptedInvite = Boolean(invite.accepted_at);
              const failedInvite = invite.send_status === "failed";
              return (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {invite.email}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{invite.role}</span>
                      <InviteStatusBadge invite={invite} />
                      {invite.last_sent_at && (
                        <span>sent {new Date(invite.last_sent_at).toLocaleString()}</span>
                      )}
                    </p>
                    {failedInvite && invite.send_error && (
                      <p className="mt-1 text-xs text-upflow-danger">
                        {invite.send_error}
                      </p>
                    )}
                  </div>
                  {!acceptedInvite && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onResend(invite)}
                        disabled={resending === invite.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 disabled:opacity-60"
                      >
                        <RotateCw
                          className={cn(
                            "h-3.5 w-3.5",
                            resending === invite.id && "animate-spin",
                          )}
                        />
                        {resending === invite.id ? "Sending..." : "Resend"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onCancel(invite)}
                        disabled={canceling === invite.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-upflow-danger/10 hover:text-upflow-danger disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}
                  {acceptedInvite && (
                    <button
                      type="button"
                      onClick={() => onReset(invite.email)}
                      disabled={resetting}
                      className="inline-flex items-center gap-1.5 rounded-md border border-upflow-danger/40 px-2.5 py-1.5 text-xs font-medium text-upflow-danger hover:bg-upflow-danger/10 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function InviteStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TesterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InviteStatusBadge({ invite }: { invite: PendingInvite }) {
  if (invite.accepted_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-upflow-success/15 px-2 py-0.5 text-[11px] font-medium text-upflow-success">
        <CheckCircle2 className="h-3 w-3" />
        accepted
      </span>
    );
  }
  if (invite.send_status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-upflow-danger/15 px-2 py-0.5 text-[11px] font-medium text-upflow-danger">
        <XCircle className="h-3 w-3" />
        failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
      <MailCheck className="h-3 w-3" />
      sent
    </span>
  );
}
