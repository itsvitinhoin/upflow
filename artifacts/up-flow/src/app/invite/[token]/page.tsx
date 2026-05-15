"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface InviteInfo {
  email: string;
  role: "owner" | "admin" | "member";
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          You&apos;ve been invited
        </h1>
        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}
        {!error && !info && (
          <p className="text-sm text-muted-foreground">Loading invite…</p>
        )}
        {info && (
          <>
            <p className="text-sm text-muted-foreground mb-1">
              {info.inviter?.name || "Someone"} invited you to join
            </p>
            <p className="text-lg font-medium text-foreground mb-4">
              {info.workspace.name}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Invite for <span className="text-foreground">{info.email}</span>
              {" · "}
              role <span className="text-foreground">{info.role}</span>
            </p>
            <button
              onClick={accept}
              disabled={busy}
              className="w-full rounded-lg bg-foreground text-background py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Accepting…" : "Accept invite"}
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Not signed in?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(`/invite/${params.token}`)}`}
                className="underline"
              >
                Sign in first
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
