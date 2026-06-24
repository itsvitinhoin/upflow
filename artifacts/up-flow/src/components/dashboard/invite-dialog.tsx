"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Mail } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

type InviteErrorCode =
  | "APP_URL_MISSING"
  | "EMAIL_NOT_CONFIGURED"
  | "EMAIL_SEND_FAILED";
type InviteMode = "personal_workspace" | "workspace_access";
type WorkspaceInviteRole = "admin" | "member" | "guest";

export default function InviteDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  successLabel,
  defaultRole = "member",
  lockRole = false,
  hideRole = false,
  workspaceId,
  testerMode = false,
  defaultMode = "workspace_access",
  hideMode = false,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  successLabel?: string;
  defaultRole?: WorkspaceInviteRole;
  lockRole?: boolean;
  hideRole?: boolean;
  workspaceId?: string;
  testerMode?: boolean;
  defaultMode?: InviteMode;
  hideMode?: boolean;
  onSuccess?: () => void;
}) {
  const { t } = useLanguage();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<WorkspaceInviteRole>(defaultRole);
  const [inviteMode, setInviteMode] = useState<InviteMode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{
    message: string;
    code?: InviteErrorCode;
  } | null>(null);
  const hasEmails = emails
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean).length > 0;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRole(defaultRole);
    setInviteMode(defaultMode);
  }, [defaultMode, defaultRole, open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = emails
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) {
      toast.error(t("invite.addAtLeastOne"));
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
          mode: testerMode ? "workspace_access" : inviteMode,
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
          message: data.error || t("invite.couldNotSend"),
          code: data.code,
        });
        throw new Error(data.error || t("invite.couldNotSend"));
      }
      const sent = data.sent ?? 0;
      const mailed = data.mailed ?? sent;
      const noun = sent === 1 ? t("invite.teammate") : t("invite.teammates");
      if (mailed !== sent) {
        setError({ message: t("invite.deliveryNotConfirmed") });
        throw new Error(t("invite.deliveryNotConfirmed"));
      }
      toast.success(`${successLabel || t("invite.successDefault")} ${sent} ${noun}`);
      setEmails("");
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("invite.couldNotSend"));
    } finally {
      setLoading(false);
    }
  };
  const showRoleControl = !hideRole || (!testerMode && inviteMode === "workspace_access");
  const modeDescription =
    inviteMode === "workspace_access"
      ? t("invite.workspaceModeHint")
      : t("invite.personalModeHint");

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
            <h2 className="text-base font-semibold text-foreground">
              {title || t("invite.titleDefault")}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block text-xs font-medium text-foreground mb-1.5">
          {t("invite.emailLabel")}
        </label>
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="alice@acme.com, bob@acme.com"
          rows={4}
          autoFocus
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        {!testerMode && !hideMode && (
          <div className="mt-4">
            <label className="block text-xs font-medium text-foreground mb-1.5">
              {t("invite.mode")}
            </label>
            <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1 text-sm">
              <button
                type="button"
                onClick={() => setInviteMode("personal_workspace")}
                className={`rounded-md px-3 py-2 font-medium transition ${
                  inviteMode === "personal_workspace"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("invite.ownWorkspace")}
              </button>
              <button
                type="button"
                onClick={() => setInviteMode("workspace_access")}
                className={`rounded-md px-3 py-2 font-medium transition ${
                  inviteMode === "workspace_access"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("invite.workspaceAccess")}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {modeDescription}
            </p>
          </div>
        )}
        {showRoleControl && (
          <>
            <label className="block text-xs font-medium text-foreground mt-4 mb-1.5">{t("invite.role")}</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceInviteRole)}
              disabled={lockRole}
              className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="member">{t("common.member")}</option>
              <option value="admin">{t("common.admin")}</option>
              <option value="guest">{t("common.guest")}</option>
            </select>
          </>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          {description || t("invite.descriptionDefault")}
        </p>
        {error && (
          <div className="mt-4 rounded-lg border border-upflow-danger/30 bg-upflow-danger/10 px-3 py-2">
            <p className="text-xs font-medium text-upflow-danger">
              {error.code ? `${error.code}: ` : ""}
              {error.message}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {inviteErrorHint(error.code, t)}
            </p>
          </div>
        )}
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-white/10 text-foreground text-sm py-2 rounded-lg hover:bg-white/10 disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={loading || !hasEmails}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel || t("invite.submitDefault")}
          </button>
        </div>
      </form>
    </div>
  );
}

function inviteErrorHint(
  code: InviteErrorCode | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (code === "APP_URL_MISSING") {
    return t("invite.appUrlMissing");
  }
  if (code === "EMAIL_NOT_CONFIGURED") {
    return t("invite.emailNotConfigured");
  }
  if (code === "EMAIL_SEND_FAILED") {
    return t("invite.emailSendFailed");
  }
  return t("invite.checkSetup");
}
