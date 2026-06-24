"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

interface InviteInfo {
  email: string;
  role: "owner" | "admin" | "member" | "guest";
  tester_invite?: boolean;
  invite_mode?: "personal_workspace" | "workspace_access";
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
  const { t } = useLanguage();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [accountEmail, setAccountEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  useEffect(() => {
    fetch(`/api/invites/accept?token=${encodeURIComponent(params.token)}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(j.error || t("invite.notFound"));
          return;
        }
        const data = (await r.json()) as InviteInfo;
        setInfo(data);
        setAccountEmail(data.email);
      })
      .catch(() => setError(t("invite.loadFailed")));
  }, [params.token, t]);

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
      setError(data.error || t("invite.acceptFailed"));
      setBusy(false);
      return;
    }
    router.push("/");
  }

  async function signInAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!info) return;
    setBusy(true);
    setError(null);

    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: info.email, password: signInPassword }),
    });
    const loginData = await loginRes.json().catch(() => ({}));
    if (!loginRes.ok) {
      setError(loginData.error || t("invite.signInFailed"));
      setBusy(false);
      return;
    }

    const acceptRes = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token }),
    });
    const acceptData = await acceptRes.json().catch(() => ({}));
    if (!acceptRes.ok) {
      setError(acceptData.error || t("invite.signInAcceptFailed"));
      setBusy(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/invites/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: params.token,
        email: accountEmail,
        full_name: fullName,
        phone,
        password,
      }),
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
      setError(data.error || t("invite.accountExists"));
      setBusy(false);
      return;
    }
    if (!r.ok) {
      setError(data.error || t("invite.createAccountFailed"));
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-background px-4 py-6">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          {t("invite.pageTitle")}
        </h1>
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        {!error && !info && (
          <p className="text-sm text-muted-foreground">{t("invite.loading")}</p>
        )}
        {info && (
          <>
            {(info.tester_invite || info.invite_mode === "workspace_access") && (
              <p className="mb-3 inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {info.tester_invite ? t("invite.testerBadge") : t("invite.workspaceAccessBadge")}
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-1">
              {t("invite.invitedBy", {
                name: info.inviter?.name || t("invite.someone"),
              })}
            </p>
            <p className="text-lg font-medium text-foreground mb-4">
              {info.invite_mode === "workspace_access" || info.tester_invite
                ? info.workspace.name
                : t("invite.productName")}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              {t("invite.inviteFor")} <span className="text-foreground">{info.email}</span>
            </p>
            <p className="mb-6 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
              {info.tester_invite ? (
                <>
                  {t("invite.testerExplanation")}
                </>
              ) : info.invite_mode === "workspace_access" ? (
                <>
                  {t("invite.workspaceAccessExplanation", {
                    workspace: info.workspace.name,
                  })}
                </>
              ) : (
                <>
                  {t("invite.personalWorkspaceExplanation", {
                    workspace: info.workspace.name,
                  })}
                </>
              )}
            </p>
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
                {t("invite.createAccount")}
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
                {t("invite.signIn")}
              </button>
            </div>

            {mode === "create" ? (
              <form onSubmit={createAccount} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("invite.email")}
                  </label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("invite.fullName")}
                  </label>
                  <input
                    name="name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("invite.fullNamePlaceholder")}
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("invite.cellphone")}
                  </label>
                  <input
                    type="tel"
                    name="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("invite.password")}
                  </label>
                  <input
                    type="password"
                    name="new-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                    placeholder={t("invite.passwordPlaceholder")}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy ? t("invite.creating") : t("invite.createAndOpen")}
                </button>
              </form>
            ) : (
              <form onSubmit={signInAndAccept} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("invite.email")}
                  </label>
                  <input
                    type="email"
                    value={info.email}
                    readOnly
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t("invite.password")}
                  </label>
                  <input
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    required
                    placeholder={t("invite.enterPassword")}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy ? t("invite.signingIn") : t("invite.signInAndOpen")}
                </button>
                <button
                  type="button"
                  onClick={accept}
                  disabled={busy}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-medium text-foreground transition hover:bg-white/10 disabled:opacity-50"
                >
                  {t("invite.alreadySignedIn")}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  {t("invite.fullLoginPrompt")}{" "}
                  <Link
                    href={`/login?next=${encodeURIComponent(`/invite/${params.token}`)}&email=${encodeURIComponent(info.email)}`}
                    className="underline"
                  >
                    {t("invite.openSignIn")}
                  </Link>
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
