"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Mail } from "lucide-react";

export default function InviteDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);

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
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: list, role }),
      });
      const data = (await res.json()) as {
        error?: string;
        sent?: number;
        mailed?: number;
      };
      if (!res.ok) throw new Error(data.error || "Failed");
      const sent = data.sent ?? 0;
      const mailed = data.mailed ?? sent;
      const noun = `teammate${sent === 1 ? "" : "s"}`;
      if (mailed === sent) {
        toast.success(`Invited ${sent} ${noun}`);
      } else if (mailed === 0) {
        toast.warning(
          `Invited ${sent} ${noun}, but no emails were sent. Copy the accept link from the team page.`,
        );
      } else {
        toast.warning(
          `Invited ${sent} ${noun}; only ${mailed} email${mailed === 1 ? "" : "s"} delivered. Check the team page to resend.`,
        );
      }
      setEmails("");
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
        className="glass-strong rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Invite to team</h2>
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
        <label className="block text-xs font-medium text-foreground mt-4 mb-1.5">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full border border-white/10 bg-white/5 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <p className="text-[11px] text-muted-foreground mt-2">
          We&apos;ll email each address an invitation link.
        </p>
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
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium py-2 rounded-lg"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send invites
          </button>
        </div>
      </form>
    </div>
  );
}
