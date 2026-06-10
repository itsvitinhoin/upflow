"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Plus, Trash2, XCircle } from "lucide-react";
import type { Department } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DEPARTMENT_COLORS,
  colorDotClass,
  type DepartmentColor,
} from "@/lib/department-colors";
import type { TesterWorkspace } from "@/components/team/team-page-types";

export function CreateTesterAccountDialog({
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
    if (loading) return;
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
        workspaceName:
          json.workspace?.name || workspace?.name || "UP Flow Test Workspace",
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

export function ManageDepartmentsDialog({
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
    if (!newName.trim() || busy) return;
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
        <div className="mb-4 flex items-center justify-between">
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

        <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
          {departments.length === 0 && (
            <p className="py-2 text-xs text-muted-foreground">
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

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-foreground">Add department</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Engineering"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="min-w-[160px] flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm"
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <button
              type="button"
              onClick={create}
              disabled={busy || !newName.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
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
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-border focus:border-border"
        aria-label={`Department name (${dep.name})`}
      />
      <span className="text-xs text-muted-foreground">
        {dep._count.members}
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${dep.name}`}
        className="p-1 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
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
            "h-4 w-4 rounded-full transition-transform",
            colorDotClass(c),
            value === c && "scale-110 ring-2 ring-foreground ring-offset-1",
          )}
        />
      ))}
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
