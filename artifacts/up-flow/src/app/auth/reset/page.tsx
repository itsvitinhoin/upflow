"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Zap, ArrowLeft } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { establishPasswordRecoverySession } from "@/lib/supabase/recovery";
import { useLanguage } from "@/components/language-provider";

/**
 * Set-a-new-password landing page.
 *
 * Supabase returns either a PKCE `?code=` or a legacy
 * `#access_token=...&type=recovery` callback. We exchange it client-side,
 * then call `updateUser({ password })` once the user submits a new password.
 */
export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Handle the recovery callback ourselves so we support both Supabase's
    // PKCE `?code=` callbacks and legacy `#access_token=` callbacks.
    const supabase = createSupabaseBrowserClient({ detectSessionInUrl: false });

    void (async () => {
      try {
        const result = await establishPasswordRecoverySession(supabase, {
          search: window.location.search,
          hash: window.location.hash,
        });
        if (!active) return;

        if (result !== "ready") {
          setError(t("auth.reset.invalidLink"));
          return;
        }

        // Tokens and one-time codes should not remain in browser history.
        window.history.replaceState(null, "", window.location.pathname);
        setReady(true);
      } catch {
        if (active) setError(t("auth.reset.invalidLink"));
      }
    })();

    return () => {
      active = false;
    };
  }, [t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.reset.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.reset.passwordsMismatch"));
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: uErr } = await supabase.auth.updateUser({ password });
      if (uErr) {
        toast.error(uErr.message || t("auth.reset.updateFailed"));
        return;
      }
      toast.success(t("auth.reset.updated"));
      // A full navigation lets the browser persist session cookies first.
      window.location.assign("/");
    } catch {
      toast.error(t("auth.reset.updateRequestFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.25), transparent 50%), radial-gradient(circle at 80% 70%, hsl(var(--upflow-success) / 0.15), transparent 50%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-4 shadow-lg shadow-primary/30">
            <Zap className="w-7 h-7 text-white" fill="currentColor" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t("auth.reset.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("auth.reset.subtitle")}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          {error ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-foreground">{error}</p>
              <Link
                href="/auth/forgot"
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 px-4 rounded-lg transition-colors"
              >
                {t("auth.reset.requestNewLink")}
              </Link>
            </div>
          ) : !ready ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("auth.reset.newPassword")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="********"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {t("auth.reset.confirmPassword")}
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  placeholder="********"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold py-2.5 px-4 rounded-lg transition-colors shadow-md shadow-primary/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("auth.reset.updating")}
                  </>
                ) : (
                  t("auth.reset.updatePassword")
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-border text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("auth.backToSignIn")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
