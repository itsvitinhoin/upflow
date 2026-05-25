"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface InviteInfo {
  email: string;
  role: "owner" | "admin" | "member";
  tester_invite?: boolean;
  last_sent_at?: string | null;
  workspace: { id: string; name: string };
  inviter: { name: string; email: string } | null;
}

export default function AcceptInvitePage({
  params,
}: {
  params: { token: string };
}) {
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    fetch(`/api/invites/accept?token=${encodeURIComponent(params.token)}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(j.error || "Invite not found");
          return;
        }
        const data = (await r.json()) as InviteInfo;
        setInfo(data);
        setName(data.email.split("@")[0]);
      })
      .catch(() => setError("Failed to load invite"));
  }, [params.token]);

  async function accept() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token }),
    });
    if (r.status === 401) {
      router.push(
        `/login?next=${encodeURIComponent(`/invite/${params.token}`)}`,
      );
      return;
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(data.error || "Could not accept invite");
      setBusy(false);
      return;
    }
    router.push("/");
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/invites/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token, name, password }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 202 && data.code === "SIGN_IN_REQUIRED") {
      router.push(
        `/login?next=${encodeURIComponent(`/invite/${params.token}`)}&email=${encodeURIComponent(info?.email ?? "")}`,
      );
      return;
    }
    if (r.status === 409 && data.code === "ACCOUNT_EXISTS") {
      setMode("signin");
      setError(data.error || "Account already exists. Sign in to accept.");
      setBusy(false);
      return;
    }
    if (!r.ok) {
      setError(data.error || "Could not create account");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          You&apos;ve been invited
        </h1>
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        {!error && !info && (
          <p className="text-sm text-muted-foreground">Loading invite...</p>
        )}
        {info && (
          <>
            {info.tester_invite && (
              <p className="mb-3 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                Tester workspace
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-1">
              {info.inviter?.name || "Someone"} invited you to join
            </p>
            <p className="text-lg font-medium text-foreground mb-4">
              {info.workspace.name}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Invite for <span className="text-foreground">{info.email}</span>
              {" - "}
              role <span className="text-foreground">{info.role}</span>
            </p>
            {info.tester_invite && (
              <p className="mb-6 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
                This invite opens an isolated UP Flow test workspace with demo
                projects, clients, meetings, docs, and tasks. It does not grant
                access to real client workspaces.
              </p>
            )}
            <div className="mb-4 grid grid-cols-2 rounded-lg border border-white/10 bg-white/5 p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("create")}
                className={`rounded-md px-3 py-2 font-medium transition ${
                  mode === "create"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`rounded-md px-3 py-2 font-medium transition ${
                  mode === "signin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign in
              </button>
            </div>

            {mode === "create" ? (
              <form onSubmit={createAccount} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "Creating..." : "Create account and join"}
                </button>
              </form>
            ) : (
              <>
                <button
                  onClick={accept}
                  disabled={busy}
                  className="w-full rounded-lg bg-foreground py-2 text-sm font-medium text-background disabled:opacity-50"
                >
                  {busy ? "Accepting..." : "Accept invite"}
                </button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  You must be signed in as {info.email}.{" "}
                  <Link
                    href={`/login?next=${encodeURIComponent(`/invite/${params.token}`)}&email=${encodeURIComponent(info.email)}`}
                    className="underline"
                  >
                    Sign in here
                  </Link>
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
