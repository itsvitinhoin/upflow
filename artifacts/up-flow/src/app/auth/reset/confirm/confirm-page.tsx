"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Zap } from "lucide-react";
import { getPasswordRecoveryActionLink } from "@/lib/supabase/recovery-link";
import { useLanguage } from "@/components/language-provider";

/**
 * An email scanner may fetch the link in a reset email before its recipient
 * does. This interstitial deliberately waits for an explicit button click
 * before navigating to Supabase's one-time recovery action link.
 */
export default function ResetConfirmationPage() {
  const { t } = useLanguage();
  const [actionLink, setActionLink] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [temporaryError, setTemporaryError] = useState(false);
  // Keep callback inputs available if React replays this effect while
  // developing. Both inputs are scrubbed from history after the first read.
  const recoveryHash = useRef<string | null>(null);
  const recoveryStateRef = useRef<string | null>(null);
  const continuationStarted = useRef(false);

  useEffect(() => {
    const state = recoveryStateRef.current ?? new URLSearchParams(window.location.search).get("state");
    recoveryStateRef.current = state;

    const hash = recoveryHash.current ?? window.location.hash;
    recoveryHash.current = hash;
    const recoveryActionLink = state
      ? null
      : getPasswordRecoveryActionLink({
          hash,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          expectedRedirectTo: `${window.location.origin}/auth/reset`,
        });

    // `state` is encrypted and the legacy fragment can contain a one-time
    // token. Keep both out of browser history and telemetry payloads early.
    window.history.replaceState(null, "", window.location.pathname);

    if (state) {
      setRecoveryState(state);
      return;
    }

    if (!recoveryActionLink) {
      setInvalid(true);
      return;
    }

    setActionLink(recoveryActionLink);
  }, []);

  async function continueToReset() {
    if (continuationStarted.current) return;
    continuationStarted.current = true;

    if (actionLink) {
      window.location.replace(actionLink);
      return;
    }
    if (!recoveryState) {
      continuationStarted.current = false;
      return;
    }

    setTemporaryError(false);
    setContinuing(true);
    let navigating = false;
    try {
      const response = await fetch("/api/auth/forgot/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: recoveryState }),
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      const payload = (await response.json().catch(() => null)) as { actionLink?: unknown } | null;
      if (response.status === 400) {
        setInvalid(true);
        return;
      }
      if (!response.ok || typeof payload?.actionLink !== "string") {
        setTemporaryError(true);
        return;
      }

      navigating = true;
      window.location.replace(payload.actionLink);
    } catch {
      setTemporaryError(true);
    } finally {
      setContinuing(false);
      if (!navigating) continuationStarted.current = false;
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.25), transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--upflow-success) / 0.15), transparent 50%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <Zap className="h-7 w-7 text-white" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t("auth.reset.confirmTitle")}</h1>
          <p className="mt-1 text-muted-foreground">{t("auth.reset.confirmSubtitle")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl">
          {invalid ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-foreground">{t("auth.reset.invalidLink")}</p>
              <Link
                href="/auth/forgot"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("auth.reset.requestNewLink")}
              </Link>
            </div>
          ) : !actionLink && !recoveryState ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={continueToReset}
                disabled={continuing}
                className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {continuing ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.reset.continue")}
              </button>
              {temporaryError ? (
                <p className="text-center text-sm text-muted-foreground" role="alert">
                  {t("auth.reset.continueFailed")}
                </p>
              ) : null}
            </div>
          )}

          <div className="mt-6 border-t border-border pt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("auth.backToSignIn")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
