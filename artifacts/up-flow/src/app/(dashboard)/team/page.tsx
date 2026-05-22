"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Mail,
  RotateCw,
  ChevronDown,
  ChevronRight,
  Settings2,
  Plus,
  Trash2,
  Search,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import Header from "@/components/layout/header";
import InviteDialog from "@/components/dashboard/invite-dialog";
import { clearCachedJson, getCachedJson } from "@/lib/client-cache";
import { cn, getInitials } from "@/lib/utils";
import type { Department, TeamMember } from "@/lib/types";
import {
  DEPARTMENT_COLORS,
  colorDotClass,
  type DepartmentColor,
} from "@/lib/department-colors";

interface PendingInvite {
  id: string;
  email: string;
  role: "admin" | "member";
  token: string;
  created_at: string;
  inviter: { id: string; name: string; email: string } | null;
}

interface EmailStatus {
  app_url_configured: boolean;
  resend_api_key_configured: boolean;
  email_from_configured: boolean;
  using_development_sender: boolean;
  ready: boolean;
}

interface TeamOverview {
  workspace: { id: string; name: string; slug: string } | null;
  current_role: "owner" | "admin" | "member" | null;
  is_super_admin: boolean;
  members: TeamMember[];
  departments: Department[];
}

const UNASSIGNED_KEY = "__unassigned__";
const COLLAPSE_STORAGE_KEY = "upflow:team:collapsedDepartments";

export default function TeamPage() {
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] =
    useState<"owner" | "admin" | "member" | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showEmpty, setShowEmpty] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDiagnosticsLoaded, setInviteDiagnosticsLoaded] = useState(false);

  // Mirrors the server's `isWorkspaceAdmin` semantics: workspace owner/admin
  // OR cross-workspace super-admin can manage departments + assignments.
  const isAdmin =
    isSuperAdmin || currentRole === "owner" || currentRole === "admin";

  const loadPending = useCallback(async () => {
    try {
      const r = await fetch("/api/invites");
      if (!r.ok) return;
      const data = (await r.json()) as PendingInvite[];
      setPending(Array.isArray(data) ? data : []);
    } catch {
      /* noop */
    }
  }, []);

  const loadEmailStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/email/status");
      if (!r.ok) {
        setEmailStatus(null);
        return;
      }
      setEmailStatus((await r.json()) as EmailStatus);
    } catch {
      setEmailStatus(null);
    }
  }, []);

  const loadInviteDiagnostics = useCallback(async () => {
    if (inviteDiagnosticsLoaded) return;
    setInviteDiagnosticsLoaded(true);
    await Promise.all([loadPending(), loadEmailStatus()]);
  }, [inviteDiagnosticsLoaded, loadEmailStatus, loadPending]);

  const loadDepartments = useCallback(async (wsId: string) => {
    try {
      const r = await fetch(`/api/workspaces/${wsId}/departments`);
      if (!r.ok) return;
      const data = (await r.json()) as { items: Department[] };
      setDepartments(data.items ?? []);
    } catch {
      /* noop */
    }
  }, []);

  // Restore collapse state from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setCollapsed(new Set(arr));
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COLLAPSE_STORAGE_KEY,
        JSON.stringify(Array.from(collapsed)),
      );
    } catch {
      /* noop */
    }
  }, [collapsed]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const overview = await getCachedJson<TeamOverview>(
          "team:overview",
          "/api/team/overview",
          { ttlMs: 30_000 },
        );
        if (cancelled) return;
        const wsId: string | null = overview.workspace?.id ?? null;
        setWorkspaceId(wsId);
        setCurrentRole(overview.current_role ?? null);
        setIsSuperAdmin(overview.is_super_admin === true);
        setUsers(overview.members ?? []);
        setDepartments(overview.departments ?? []);
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin || !workspaceId || !inviteDiagnosticsLoaded) {
      setEmailStatus(null);
      return;
    }
    loadEmailStatus();
  }, [inviteDiagnosticsLoaded, isAdmin, workspaceId, loadEmailStatus]);

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function setMemberDepartment(
    userId: string,
    departmentId: string | null,
  ) {
    if (!workspaceId) return;
    // Remember the previous value so we can roll back on failure.
    const previous =
      users.find((u) => u.id === userId)?.department_id ?? null;
    // Optimistic update.
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, department_id: departmentId } : u,
      ),
    );
    try {
      const r = await fetch(
        `/api/workspaces/${workspaceId}/members/${userId}/department`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ department_id: departmentId }),
        },
      );
      if (!r.ok) {
        // Roll back so the UI doesn't show an assignment the server rejected.
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, department_id: previous } : u,
          ),
        );
        setToast("Couldn't update department");
      } else {
        clearCachedJson("team:overview");
        loadDepartments(workspaceId);
      }
    } catch {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, department_id: previous } : u,
        ),
      );
      setToast("Couldn't update department");
    }
  }

  async function updateMember(
    userId: string,
    patch: {
      role?: "owner" | "admin" | "member";
      status?: "active" | "inactive";
      department_id?: string | null;
    },
  ) {
    if (!workspaceId) return;
    const previous = users.find((u) => u.id === userId);
    if (!previous) return;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              ...(patch.role && { workspace_role: patch.role }),
              ...(patch.status && { workspace_status: patch.status }),
              ...(patch.department_id !== undefined && { department_id: patch.department_id }),
            }
          : u,
      ),
    );
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error("Failed to update member");
      clearCachedJson("team:overview");
      setToast("Member updated");
      if (patch.department_id !== undefined) loadDepartments(workspaceId);
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === userId ? previous : u)));
      setToast("Couldn't update member");
    }
  }

  async function removeMember(user: TeamMember) {
    if (!workspaceId) return;
    if (!window.confirm(`Remove ${user.name} from this workspace?`)) return;
    const previous = users;
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/members/${user.id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error("Failed to remove member");
      clearCachedJson("team:overview");
      setToast("Member removed");
      loadDepartments(workspaceId);
    } catch {
      setUsers(previous);
      setToast("Couldn't remove member");
    }
  }

  // Group users by department.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byId = new Map<string, TeamMember[]>();
    byId.set(UNASSIGNED_KEY, []);
    departments.forEach((d) => byId.set(d.id, []));
    for (const u of users) {
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      if (!matchesQuery) continue;
      const key = u.department_id ?? UNASSIGNED_KEY;
      if (!byId.has(key)) byId.set(key, []);
      byId.get(key)!.push(u);
    }
    return byId;
  }, [users, departments, query]);

  const isSearching = query.trim().length > 0;

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
        const json = (await r.json().catch(() => ({}))) as { error?: string };
        setToast(json.error || `Couldn't resend to ${invite.email}`);
      } else {
        const json = (await r.json()) as {
          mailed?: number;
        };
        if (json.mailed && json.mailed > 0) {
          setToast(`Invite re-sent to ${invite.email}`);
        } else {
          setToast("Invite email delivery was not confirmed");
        }
        loadPending();
      }
    } catch {
      setToast(`Couldn't resend to ${invite.email}`);
    } finally {
      setResending(null);
    }
  }

  const orderedGroups: Array<{
    key: string;
    name: string;
    color: string;
    members: TeamMember[];
  }> = [
    ...departments.map((d) => ({
      key: d.id,
      name: d.name,
      color: d.color,
      members: groups.get(d.id) ?? [],
    })),
    {
      key: UNASSIGNED_KEY,
      name: "Unassigned",
      color: "slate",
      members: groups.get(UNASSIGNED_KEY) ?? [],
    },
  ];

  return (
    <>
      <Header title="Team" />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">Team Members</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {users.length} member{users.length !== 1 ? "s" : ""}
              {departments.length > 0 && (
                <>
                  {" · "}
                  {departments.length} department
                  {departments.length !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>
          {isAdmin && workspaceId && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setInviteOpen(true);
                  loadInviteDiagnostics();
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite member
              </button>
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Manage departments
              </button>
            </div>
          )}
        </div>

        {isAdmin && emailStatus && !emailStatus.ready && (
          <EmailSetupWarning status={emailStatus} />
        )}

        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search members…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm"
              aria-label="Search members"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={showEmpty}
              onChange={(e) => setShowEmpty(e.target.checked)}
              className="rounded border-border"
            />
            Show empty groups
          </label>
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
        ) : isSearching &&
          orderedGroups.every((g) => g.members.length === 0) ? (
          <div
            data-testid="team-search-empty"
            className="text-center py-16 text-muted-foreground"
          >
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No members match &ldquo;{query}&rdquo;</p>
            <p className="text-xs mt-1">Try a different name or email.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orderedGroups.map((g) => {
              const isUnassigned = g.key === UNASSIGNED_KEY;
              const memberCount = g.members.length;
              // When searching, auto-expand groups that have matches and
              // hide groups with zero matches. Otherwise honor the
              // user-stored collapse state and the "show empty" toggle.
              if (isSearching && memberCount === 0) return null;
              if (!isSearching && memberCount === 0 && !showEmpty && !isUnassigned)
                return null;
              if (
                !isSearching &&
                isUnassigned &&
                memberCount === 0 &&
                !showEmpty
              )
                return null;

              const isCollapsed =
                !isSearching && collapsed.has(g.key) && memberCount > 0;

              return (
                <section
                  key={g.key}
                  data-testid="department-group"
                  data-department-key={g.key}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(g.key)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-full flex-shrink-0",
                        colorDotClass(g.color),
                      )}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-sm text-foreground">
                      {g.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {!isCollapsed && memberCount > 0 && (
                    <ul className="divide-y divide-border border-t border-border">
                      {g.members.map((user) => (
                        <li
                          key={user.id}
                          className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                            {getInitials(user.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {user.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                          <div className="hidden sm:flex flex-col items-end gap-1">
                            <span
                              className={cn(
                                "text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                                (user.workspace_role ?? user.role) === "admin" ||
                                  user.workspace_role === "owner"
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {user.workspace_role ?? user.role}
                            </span>
                            {user.workspace_status === "inactive" && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-upflow-danger/15 text-upflow-danger">
                                inactive
                              </span>
                            )}
                          </div>
                          {isAdmin ? (
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              <select
                                aria-label={`Role for ${user.name}`}
                                value={user.workspace_role ?? user.role}
                                onChange={(e) =>
                                  updateMember(user.id, {
                                    role: e.target.value as "owner" | "admin" | "member",
                                  })
                                }
                                className="text-xs rounded-md border border-border bg-card px-2 py-1"
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                                <option value="owner">Owner</option>
                              </select>
                              <select
                                aria-label={`Status for ${user.name}`}
                                value={user.workspace_status ?? "active"}
                                onChange={(e) =>
                                  updateMember(user.id, {
                                    status: e.target.value as "active" | "inactive",
                                  })
                                }
                                className="text-xs rounded-md border border-border bg-card px-2 py-1"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                              <select
                                aria-label={`Department for ${user.name}`}
                                value={user.department_id ?? ""}
                                onChange={(e) =>
                                  updateMember(user.id, {
                                    department_id: e.target.value || null,
                                  })
                                }
                                className="text-xs rounded-md border border-border bg-card px-2 py-1"
                              >
                                <option value="">Unassigned</option>
                                {departments.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeMember(user)}
                                aria-label={`Remove ${user.name}`}
                                className="p-1.5 text-muted-foreground hover:text-upflow-danger rounded-md hover:bg-upflow-danger/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full",
                                  colorDotClass(g.color),
                                )}
                                aria-hidden="true"
                              />
                              {g.name}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {pending.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Pending invites
                </h3>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {pending.length} invite{pending.length !== 1 ? "s" : ""}{" "}
                  awaiting acceptance
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
                        <p className="text-sm font-medium text-foreground truncate">
                          {p.email}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {p.role}
                          {p.inviter
                            ? ` · invited by ${p.inviter.name || p.inviter.email}`
                            : ""}
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
                        className={cn(
                          "w-3.5 h-3.5",
                          resending === p.id && "animate-spin",
                        )}
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

        {manageOpen && workspaceId && (
          <ManageDepartmentsDialog
            workspaceId={workspaceId}
            departments={departments}
            onClose={() => setManageOpen(false)}
            onChanged={() => {
              clearCachedJson("team:overview");
              loadDepartments(workspaceId);
            }}
          />
        )}
        <InviteDialog
          open={inviteOpen}
          onClose={() => {
            setInviteOpen(false);
            if (inviteDiagnosticsLoaded) {
              loadPending();
              loadEmailStatus();
            }
          }}
        />
      </div>
    </>
  );
}

function EmailSetupWarning({ status }: { status: EmailStatus }) {
  const missing = [
    !status.app_url_configured && "APP_URL",
    !status.resend_api_key_configured && "RESEND_API_KEY",
    !status.email_from_configured && "EMAIL_FROM",
  ].filter(Boolean);

  return (
    <div className="mb-4 rounded-xl border border-upflow-warning/30 bg-upflow-warning/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-upflow-warning" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            Invite email setup needs attention
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {missing.length > 0 ? `Missing: ${missing.join(", ")}. ` : ""}
            {status.using_development_sender
              ? "Set EMAIL_FROM to a verified Resend sender. "
              : ""}
            Invites are blocked until Resend delivery is configured and accepted.
          </p>
        </div>
      </div>
    </div>
  );
}

function ManageDepartmentsDialog({
  workspaceId,
  departments,
  onClose,
  onChanged,
}: {
  workspaceId: string;
  departments: Department[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<DepartmentColor>("blue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/workspaces/${workspaceId}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Couldn't create department");
      } else {
        setNewName("");
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function rename(dep: Department, name: string) {
    if (!name.trim() || name === dep.name) return;
    const r = await fetch(
      `/api/workspaces/${workspaceId}/departments/${dep.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      },
    );
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Couldn't rename department");
    } else {
      setError(null);
    }
    onChanged();
  }

  async function recolor(dep: Department, color: DepartmentColor) {
    const r = await fetch(
      `/api/workspaces/${workspaceId}/departments/${dep.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      },
    );
    if (!r.ok) {
      setError("Couldn't update department color");
    } else {
      setError(null);
    }
    onChanged();
  }

  async function remove(dep: Department) {
    if (
      !window.confirm(
        `Delete "${dep.name}"? Its members will become Unassigned.`,
      )
    )
      return;
    const r = await fetch(
      `/api/workspaces/${workspaceId}/departments/${dep.id}`,
      { method: "DELETE" },
    );
    if (!r.ok) {
      setError("Couldn't delete department");
    } else {
      setError(null);
    }
    onChanged();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage departments"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-xl w-full max-w-lg p-6 shadow-lg"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">
            Manage departments
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {departments.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No departments yet. Create one below.
            </p>
          )}
          {departments.map((d) => (
            <DepartmentRow
              key={d.id}
              dep={d}
              onRename={(name) => rename(d, name)}
              onRecolor={(c) => recolor(d, c)}
              onDelete={() => remove(d)}
            />
          ))}
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <p className="text-xs font-medium text-foreground">Add department</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="e.g. Engineering"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 min-w-[160px] rounded-md border border-border bg-card px-2 py-1.5 text-sm"
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <button
              type="button"
              onClick={create}
              disabled={busy || !newName.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function DepartmentRow({
  dep,
  onRename,
  onRecolor,
  onDelete,
}: {
  dep: Department;
  onRename: (name: string) => void;
  onRecolor: (color: DepartmentColor) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(dep.name);
  useEffect(() => setName(dep.name), [dep.name]);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
      <ColorPicker
        value={dep.color as DepartmentColor}
        onChange={(c) => onRecolor(c)}
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => onRename(name)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="flex-1 min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-border focus:border-border outline-none"
        aria-label={`Department name (${dep.name})`}
      />
      <span className="text-xs text-muted-foreground">
        {dep._count.members}
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${dep.name}`}
        className="text-muted-foreground hover:text-destructive p-1"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: DepartmentColor;
  onChange: (c: DepartmentColor) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {DEPARTMENT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={cn(
            "w-4 h-4 rounded-full transition-transform",
            colorDotClass(c),
            value === c && "ring-2 ring-offset-1 ring-foreground scale-110",
          )}
        />
      ))}
    </div>
  );
}
