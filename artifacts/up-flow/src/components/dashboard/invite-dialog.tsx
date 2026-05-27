"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Mail } from "lucide-react";

type InviteErrorCode =
  | "APP_URL_MISSING"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_SEND_FAILED";

export default function InviteDialog({
  open,
  onClose,
  title = "Invite to team",
  description = "We'll email each address an invitation link.",
  submitLabel = "Send invites",
  successLabel = "Invited",
  defaultRole = "member",
  lockRole = false,
  hideRole = false,
  workspaceId,
  testerMode = false,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  successLabel?: string;
  defaultRole?: "admin" | "member";
  lockRole?: boolean;
  hideRole?: boolean;
  workspaceId?: string;
  testerMode?: boolean;
  onSuccess?: () => void;
}) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<"admin" | "member">(defaultRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{
    message: string;
    code?: InviteErrorCode;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRole(defaultRole);
  }, [defaultRole, open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = emails
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) {
      toast.error("Add at least one email");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: list,
          role,
          ...(workspaceId ? { workspace_id: workspaceId } : {}),
          ...(testerMode ? { tester_invite: true } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: InviteErrorCode;
        sent?: number;
        mailed?: number;
      };
      if (!res.ok) {
        setError({
          message: data.error || "Could not send invites",
          code: data.code,
        });
        throw new Error(data.error || "Failed");
      }
      const sent = data.sent ?? 0;
      const mailed = data.mailed ?? sent;
      const noun = `teammate${sent === 1 ? "" : "s"}`;
      if (mailed !== sent) {
        setError({ message: "Invite email delivery was not confirmed" });
        throw new Error("Invite email delivery was not confirmed");
      }
      toast.success(`${successLabel} ${sent} ${noun}`);
      setEmails("");
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not send invites");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Emails (comma or newline separated)
        </label>
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="alice@acme.com, bob@acme.com"
          rows={4}
          autoFocus
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        {!hideRole && (
          <>
            <label className="block text-xs font-medium text-foreground mt-4 mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "member")}
              disabled={lockRole}
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          {description}
        </p>
        {error && (
          <div className="mt-4 rounded-lg border border-upflow-danger/30 bg-upflow-danger/10 px-3 py-2">
            <p className="text-xs font-medium text-upflow-danger">
              {error.code ? `${error.code}: ` : ""}
              {error.message}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {inviteErrorHint(error.code)}
            </p>
          </div>
        )}
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function inviteErrorHint(code?: InviteErrorCode) {
  if (code === "APP_URL_MISSING") {
    return "Set APP_URL to the canonical public app URL and restart the app.";
  }
  if (code === "EMAIL_NOT_CONFIGURED") {
    return "Set RESEND_API_KEY and EMAIL_FROM with a verified Resend sender, then restart the app.";
  }
  if (code === "EMAIL_SEND_FAILED") {
    return "Check the Resend dashboard, API key, sender verification, recipient restrictions, and provider message.";
  }
  return "Check invite email setup and try again.";
}
