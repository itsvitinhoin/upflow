"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Mail, RotateCw } from "lucide-react";
import Header from "@/components/layout/header";
import { cn, getInitials } from "@/lib/utils";
import type { TeamMember } from "@/lib/types";

interface PendingInvite {
  id: string;
  email: string;
  role: "admin" | "member";
  token: string;
  created_at: string;
  inviter: { id: string; name: string; email: string } | null;
}

export default function TeamPage() {
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    try {
      const r = await fetch("/api/invites");
      if (!r.ok) return; // non-admin or no workspace — silently hide section
      const data = (await r.json()) as PendingInvite[];
      setPending(Array.isArray(data) ? data : []);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data: { items: TeamMember[] }) => {
        setUsers(data.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    loadPending();
  }, [loadPending]);

  async function resendInvite(invite: PendingInvite) {
    setResending(invite.id);
    setToast(null);
    try {
      const r = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: [invite.email], role: invite.role }),
      });
      if (!r.ok) {
        setToast(`Couldn't resend to ${invite.email}`);
      } else {
        const json = (await r.json()) as { mailed?: number };
        setToast(
          json.mailed && json.mailed > 0
            ? `Invite re-sent to ${invite.email}`
            : `Re-sent (email backend offline) — copy the link from the API response.`,
        );
        loadPending();
      }
    } catch {
      setToast(`Couldn't resend to ${invite.email}`);
    } finally {
      setResending(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <>
      <Header title="Team" />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">Team Members</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {users.length} member{users.length !== 1 ? "s" : ""}
          </p>
        </div>

        {loading ? (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-0"
              >
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-48 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No team members yet</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">
                    Member
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3 hidden sm:table-cell">
                    Email
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                          {getInitials(user.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                          user.role === "admin"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Pending invites</h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {pending.length} invite{pending.length !== 1 ? "s" : ""} awaiting acceptance
                </p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <ul className="divide-y divide-border">
                {pending.map((p) => (
                  <li
                    key={p.id}
                    data-testid="pending-invite"
                    className="flex items-center justify-between gap-3 px-6 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {p.role}
                          {p.inviter ? ` · invited by ${p.inviter.name || p.inviter.email}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => resendInvite(p)}
                      disabled={resending === p.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5",
                        "text-xs font-medium text-foreground hover:bg-muted/60 transition-colors",
                        "disabled:opacity-60 disabled:cursor-not-allowed",
                      )}
                      aria-label={`Resend invite to ${p.email}`}
                    >
                      <RotateCw
                        className={cn("w-3.5 h-3.5", resending === p.id && "animate-spin")}
                      />
                      {resending === p.id ? "Sending…" : "Resend"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {toast && (
              <p className="mt-3 text-xs text-muted-foreground" role="status">
                {toast}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
