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
  ShieldCheck,
  MailCheck,
  XCircle,
  CheckCircle2,
  KeyRound,
  Copy,
} from "lucide-react";
import Header from "@/components/layout/header";
import InviteDialog from "@/components/dashboard/invite-dialog";
import { clearCachedJson, getCachedJson } from "@/lib/client-cache";
import { cn, formatTime, getInitials } from "@/lib/utils";
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
  tester_invite?: boolean;
  invite_mode?: "personal_workspace" | "workspace_access";
  send_status?: "pending" | "sent" | "failed";
  send_error?: string | null;
  last_sent_at?: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  created_at: string;
  workspace?: { id: string; name: string; slug: string };
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

interface TesterWorkspace {
  id: string;
  name: string;
  slug: string;
}

const UNASSIGNED_KEY = "__unassigned__";
const COLLAPSE_STORAGE_KEY = "upflow:team:collapsedDepartments";

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

function RealUserInvitePanel({
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
            Send official invitations for two clear paths: users can get their own
            UP Flow workspace, or they can join {workspace?.name ?? "this workspace"}
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

function EmailSetupWarning({
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

function TesterInvitePanel({
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
              const accepted = Boolean(invite.accepted_at);
              const failed = invite.send_status === "failed";
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
                    {failed && invite.send_error && (
                      <p className="mt-1 text-xs text-upflow-danger">
                        {invite.send_error}
                      </p>
                    )}
                  </div>
                  {!accepted && (
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
                  {accepted && (
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

function CreateTesterAccountDialog({
  open,
  workspace,
  onClose,
  onCreated,
}: {
  open: boolean;
  workspace: TesterWorkspace | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(() => generateTesterPassword());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
    workspaceName: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCreated(null);
    setPassword(generateTesterPassword());
  }, [open]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          password,
          tester_account: true,
          role: "member",
        }),
      });
      const json = (await r.json().catch(() => ({}))) as {
        error?: string;
        workspace?: { name: string };
      };
      if (!r.ok) {
        setError(json.error || "Could not create tester account");
        return;
      }
      setCreated({
        email: email.trim(),
        password,
        workspaceName: json.workspace?.name || workspace?.name || "UP Flow Test Workspace",
      });
      setEmail("");
      setName("");
      onCreated();
    } catch {
      setError("Could not create tester account");
    } finally {
      setLoading(false);
    }
  }

  const credentialText = created
    ? `UP Flow test access\nURL: ${window.location.origin}/login\nWorkspace: ${created.workspaceName}\nEmail: ${created.email}\nPassword: ${created.password}`
    : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create tester account"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Create tester account
              </h2>
              <p className="text-xs text-muted-foreground">
                Adds access to {workspace?.name || "the isolated test workspace"}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        {created ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-upflow-success/30 bg-upflow-success/10 px-3 py-2">
              <p className="text-sm font-medium text-foreground">
                Tester account created
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Send these credentials manually through WhatsApp, Gmail, or Slack.
              </p>
            </div>
            <textarea
              readOnly
              value={credentialText}
              rows={5}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground"
            />
            <div className="grid gap-2 sm:flex">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(credentialText)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Copy className="h-4 w-4" />
                Copy credentials
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Tester email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tester@example.com"
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <label className="mb-1.5 mt-4 block text-xs font-medium text-foreground">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tester name"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <label className="mb-1.5 mt-4 block text-xs font-medium text-foreground">
              Temporary password
            </label>
            <div className="grid gap-2 sm:flex">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setPassword(generateTesterPassword())}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-foreground hover:bg-white/10"
              >
                Generate
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-upflow-danger/30 bg-upflow-danger/10 px-3 py-2">
                <p className="text-xs font-medium text-upflow-danger">{error}</p>
                {error.includes("SUPABASE_SERVICE_ROLE_KEY") && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy before
                    using manual account creation.
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-foreground hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create account"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function generateTesterPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let value = "UpFlow-";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) value += alphabet[byte % alphabet.length];
    return value;
  }
  for (let i = 0; i < 10; i++) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
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
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-lg sm:p-6"
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
          <div className="flex flex-wrap items-center gap-2">
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
