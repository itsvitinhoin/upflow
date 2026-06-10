"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Mail,
  RotateCw,
  ChevronDown,
  ChevronRight,
  Settings2,
  Trash2,
  Search,
  XCircle,
  UserPlus,
} from "lucide-react";
import Header from "@/components/layout/header";
import InviteDialog from "@/components/dashboard/invite-dialog";
import {
  CreateTesterAccountDialog,
  ManageDepartmentsDialog,
} from "@/components/team/team-management-dialogs";
import {
  EmailSetupWarning,
  RealUserInvitePanel,
  TesterInvitePanel,
} from "@/components/team/team-invite-panels";
import { clearCachedJson, getCachedJson } from "@/lib/client-cache";
import { cn, formatTime, getInitials } from "@/lib/utils";
import type { Department, TeamMember } from "@/lib/types";
import { colorDotClass } from "@/lib/department-colors";
import {
  COLLAPSE_STORAGE_KEY,
  UNASSIGNED_KEY,
  type EmailStatus,
  type PendingInvite,
  type TeamOverview,
  type TesterWorkspace,
} from "@/components/team/team-page-types";

export default function TeamPage() {
  const [users, setUsers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workspace, setWorkspace] = useState<TeamOverview["workspace"]>(null);
  const [primaryWorkspace, setPrimaryWorkspace] = useState<TeamOverview["workspace"]>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] =
    useState<"owner" | "admin" | "member" | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [cancelingInvite, setCancelingInvite] = useState<string | null>(null);
  const [resettingTester, setResettingTester] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showEmpty, setShowEmpty] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [testerInviteOpen, setTesterInviteOpen] = useState(false);
  const [testerAccountOpen, setTesterAccountOpen] = useState(false);
  const [inviteDiagnosticsLoaded, setInviteDiagnosticsLoaded] = useState(false);
  const [testerWorkspace, setTesterWorkspace] = useState<TesterWorkspace | null>(null);
  const [testerInvites, setTesterInvites] = useState<PendingInvite[]>([]);
  const [settingUpTesterWorkspace, setSettingUpTesterWorkspace] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<{
    ok: boolean;
    message: string;
    checkedAt: string;
  } | null>(null);

  // Mirrors the server's `isWorkspaceAdmin` semantics: workspace owner/admin
  // OR cross-workspace super-admin can manage departments + assignments.
  const isAdmin =
    isSuperAdmin || currentRole === "owner" || currentRole === "admin";

  const loadTeamOverview = useCallback(async (targetWorkspaceId?: string | null) => {
    setLoading(true);
    try {
      const path = targetWorkspaceId
        ? `/api/team/overview?workspace_id=${encodeURIComponent(targetWorkspaceId)}`
        : "/api/team/overview";
      const overview = await getCachedJson<TeamOverview>(
        `team:overview:${targetWorkspaceId || "current"}`,
        path,
        { ttlMs: 0, force: true },
      );
      const wsId: string | null = overview.workspace?.id ?? null;
      setWorkspace(overview.workspace ?? null);
      if (!targetWorkspaceId) setPrimaryWorkspace(overview.workspace ?? null);
      setWorkspaceId(wsId);
      setCurrentRole(overview.current_role ?? null);
      setIsSuperAdmin(overview.is_super_admin === true);
      setUsers(overview.members ?? []);
      setDepartments(overview.departments ?? []);
      setQuery("");
    } catch {
      setToast("Couldn't load team members for this workspace");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const loadTesterInvites = useCallback(async (targetWorkspaceId: string) => {
    try {
      const qs = new URLSearchParams({
        scope: "testers",
        include: "all",
        workspace_id: targetWorkspaceId,
      });
      const r = await fetch(`/api/invites?${qs.toString()}`);
      if (!r.ok) return;
      const data = (await r.json()) as PendingInvite[];
      setTesterInvites(Array.isArray(data) ? data : []);
    } catch {
      /* noop */
    }
  }, []);

  const ensureTesterWorkspace = useCallback(
    async (options?: { openDialog?: boolean }) => {
      setSettingUpTesterWorkspace(true);
      setToast(null);
      try {
        const r = await fetch("/api/testers/workspace", { method: "POST" });
        const data = (await r.json().catch(() => ({}))) as {
          workspace?: TesterWorkspace;
          error?: string;
        };
        if (!r.ok || !data.workspace) {
          setToast(data.error || "Couldn't prepare the tester workspace");
          return null;
        }
        setTesterWorkspace(data.workspace);
        await loadTesterInvites(data.workspace.id);
        if (options?.openDialog) {
          setTesterInviteOpen(true);
        }
        return data.workspace;
      } catch {
        setToast("Couldn't prepare the tester workspace");
        return null;
      } finally {
        setSettingUpTesterWorkspace(false);
      }
    },
    [loadTesterInvites],
  );

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
    loadTeamOverview();
  }, [loadTeamOverview]);

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
        body: JSON.stringify({
          emails: [invite.email],
          role: invite.role,
          ...(invite.workspace?.id ? { workspace_id: invite.workspace.id } : {}),
          ...(invite.tester_invite ? { tester_invite: true } : {}),
        }),
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
        if (invite.tester_invite && invite.workspace?.id) {
          loadTesterInvites(invite.workspace.id);
        } else {
          loadPending();
        }
      }
    } catch {
      setToast(`Couldn't resend to ${invite.email}`);
    } finally {
      setResending(null);
    }
  }

  async function cancelInvite(invite: PendingInvite) {
    if (!window.confirm(`Cancel invite for ${invite.email}?`)) return;
    setCancelingInvite(invite.id);
    setToast(null);
    try {
      const r = await fetch("/api/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invite.id }),
      });
      const json = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setToast(json.error || `Couldn't cancel invite for ${invite.email}`);
        return;
      }
      setToast(`Invite canceled for ${invite.email}`);
      if (invite.tester_invite && invite.workspace?.id) {
        loadTesterInvites(invite.workspace.id);
      } else {
        loadPending();
      }
    } catch {
      setToast(`Couldn't cancel invite for ${invite.email}`);
    } finally {
      setCancelingInvite(null);
    }
  }

  async function resetTesterAccount(defaultEmail?: string) {
    const email = window
      .prompt(
        "Reset which tester email? This removes their app account, auth account, memberships, and invite history so they can sign up again.",
        defaultEmail || "victorcheunin@gmail.com",
      )
      ?.trim()
      .toLowerCase();
    if (!email) return;
    if (
      !window.confirm(
        `Reset ${email}? This is destructive and cannot be undone. Send a fresh invite after reset.`,
      )
    ) {
      return;
    }

    setResettingTester(true);
    setToast(null);
    try {
      const r = await fetch("/api/testers/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await r.json().catch(() => ({}))) as {
        error?: string;
        app_user_deleted?: boolean;
        invites_deleted?: number;
        supabase_auth_deleted?: number;
        supabase_auth_error?: string | null;
      };
      if (!r.ok) {
        setToast(json.error || `Couldn't reset ${email}`);
        return;
      }
      setToast(
        `Reset ${email}. App user: ${json.app_user_deleted ? "deleted" : "not found"}, auth users deleted: ${json.supabase_auth_deleted ?? 0}, invites deleted: ${json.invites_deleted ?? 0}.`,
      );
      if (json.supabase_auth_error) {
        setToast(`Reset app data for ${email}, but Supabase auth reported: ${json.supabase_auth_error}`);
      }
      loadPending();
      if (testerWorkspace) loadTesterInvites(testerWorkspace.id);
    } catch {
      setToast(`Couldn't reset ${email}`);
    } finally {
      setResettingTester(false);
    }
  }

  async function sendEmailTest() {
    setTestingEmail(true);
    setEmailTestStatus(null);
    try {
      const r = await fetch("/api/email/test", { method: "POST" });
      const json = (await r.json().catch(() => ({}))) as {
        error?: string;
        recipient?: string;
      };
      if (!r.ok) {
        setEmailTestStatus({
          ok: false,
          message: json.error || "Email provider rejected the test message.",
          checkedAt: formatTime(new Date()),
        });
        return;
      }
      setEmailTestStatus({
        ok: true,
        message: `Test email accepted for ${json.recipient || "your admin email"}.`,
        checkedAt: formatTime(new Date()),
      });
    } catch {
      setEmailTestStatus({
        ok: false,
        message: "Could not send the test email.",
        checkedAt: formatTime(new Date()),
      });
    } finally {
      setTestingEmail(false);
      loadEmailStatus();
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
      <div className="mx-auto max-w-4xl overflow-x-hidden p-4 sm:p-6">
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">Team Members</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              {users.length} member{users.length !== 1 ? "s" : ""}
              {workspace?.name && (
                <>
                  {" · "}
                  viewing {workspace.name}
                </>
              )}
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setInviteOpen(true);
                  loadInviteDiagnostics();
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite users
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

        {isAdmin && emailStatus && (
          <EmailSetupWarning
            status={emailStatus}
            emailTestStatus={emailTestStatus}
            testingEmail={testingEmail}
            onSendTest={sendEmailTest}
          />
        )}

        {isAdmin && (
          <RealUserInvitePanel
            workspace={primaryWorkspace ?? workspace}
            memberCount={users.length}
            pendingCount={pending.filter((invite) => !invite.tester_invite).length}
            emailReady={emailStatus?.ready ?? null}
            onInvite={() => {
              loadInviteDiagnostics();
              setInviteOpen(true);
            }}
          />
        )}

        {isSuperAdmin && (
          <details className="mb-4 rounded-xl border border-border bg-card/50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              Sandbox tester tools · super admin only
            </summary>
            <div className="mt-3">
              <TesterInvitePanel
                workspace={testerWorkspace}
                invites={testerInvites}
                settingUp={settingUpTesterWorkspace}
                resending={resending}
                canceling={cancelingInvite}
                onPrepare={() => ensureTesterWorkspace()}
                onViewMembers={() => {
                  if (testerWorkspace) loadTeamOverview(testerWorkspace.id);
                }}
                onInvite={() => {
                  loadInviteDiagnostics();
                  ensureTesterWorkspace({ openDialog: true });
                }}
                onCreateAccount={() => {
                  ensureTesterWorkspace().then((workspace) => {
                    if (workspace) setTesterAccountOpen(true);
                  });
                }}
                onResend={resendInvite}
                onCancel={cancelInvite}
                onReset={resetTesterAccount}
                resetting={resettingTester}
              />
            </div>
          </details>
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
                          className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:px-6"
                        >
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                            {getInitials(user.name)}
                          </div>
                          <div className="min-w-0 flex-1 self-stretch sm:self-auto">
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
                            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
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
                    <div className="flex flex-wrap items-center gap-2">
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
                      {resending === p.id ? "Sending..." : "Resend"}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelInvite(p)}
                      disabled={cancelingInvite === p.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-upflow-danger/10 hover:text-upflow-danger disabled:opacity-60"
                      aria-label={`Cancel invite to ${p.email}`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                    </div>
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
          title="Invite users to Up Flow"
          description={
            workspace?.name
              ? `Choose whether each person gets their own UP Flow workspace or joins ${workspace.name} as a team member.`
              : "Choose whether each person gets their own UP Flow workspace or joins the current workspace."
          }
          submitLabel="Send user invites"
          successLabel="Invited"
          defaultRole="member"
          defaultMode="personal_workspace"
          hideRole
          onClose={() => {
            setInviteOpen(false);
            if (inviteDiagnosticsLoaded) {
              loadPending();
              loadEmailStatus();
            }
          }}
        />
        <InviteDialog
          open={testerInviteOpen}
          title="Invite testers"
          description={
            testerWorkspace
              ? `Tester invites join ${testerWorkspace.name}. Choose Member for normal testers or Admin for trusted testers.`
              : "Tester invites join the isolated test workspace. Choose Member or Admin."
          }
          submitLabel="Send tester invites"
          successLabel="Invited"
          defaultRole="member"
          testerMode
          workspaceId={testerWorkspace?.id}
          onSuccess={() => {
            if (testerWorkspace) loadTesterInvites(testerWorkspace.id);
          }}
          onClose={() => {
            setTesterInviteOpen(false);
            if (testerWorkspace) loadTesterInvites(testerWorkspace.id);
            if (inviteDiagnosticsLoaded) loadEmailStatus();
          }}
        />
        <CreateTesterAccountDialog
          open={testerAccountOpen}
          workspace={testerWorkspace}
          onClose={() => setTesterAccountOpen(false)}
          onCreated={() => {
            clearCachedJson("team:overview");
            if (testerWorkspace) loadTesterInvites(testerWorkspace.id);
          }}
        />
      </div>
    </>
  );
}
