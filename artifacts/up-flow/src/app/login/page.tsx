"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Layers3,
  Loader2,
  LockKeyhole,
  Mail,
  Moon,
  Sun,
  Users,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { useTheme } from "@/components/theme-provider";

const logoSrc = "/assets/UP_LOGO_1778594851568.png";

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="min-w-0 border-white/10 last:border-0 sm:border-r sm:pr-6">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10 text-blue-200 shadow-[0_0_28px_rgba(59,130,246,0.28)]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function LoginControlBar() {
  const { theme, setTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const isDark = theme !== "light";

  return (
    <div className="absolute right-4 top-4 z-20 flex items-center gap-3 sm:right-8 sm:top-8">
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="inline-flex h-11 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 text-slate-300 shadow-[0_0_26px_rgba(15,23,42,0.5)] backdrop-blur transition hover:border-blue-400/40 hover:text-white"
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
            !isDark ? "bg-white text-slate-950" : "text-slate-400"
          }`}
        >
          <Sun className="h-4 w-4" />
        </span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
            isDark ? "bg-white text-slate-950" : "text-slate-400"
          }`}
        >
          <Moon className="h-4 w-4" />
        </span>
      </button>
      <button
        type="button"
        onClick={toggleLanguage}
        className="inline-flex h-11 items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-violet-400/40 hover:bg-white/[0.08]"
      >
        {language === "pt-BR" ? "PT" : "EN"}
      </button>
    </div>
  );
}

function BrandPanel() {
  return (
    <section className="relative hidden min-h-dvh overflow-hidden border-r border-white/10 bg-[#050916] p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(59,130,246,0.42),transparent_34%),radial-gradient(circle_at_55%_34%,rgba(37,99,235,0.18),transparent_30%),linear-gradient(140deg,rgba(15,23,42,0.25),rgba(2,6,23,0.94))]" />
      <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="relative z-10">
        <Image
          src={logoSrc}
          alt="Up Flow"
          width={72}
          height={72}
          priority
          className="h-16 w-16 object-contain"
        />
      </div>

      <div className="relative z-10 flex justify-center">
        <div className="relative h-[360px] w-[420px] max-w-full">
          <div className="absolute left-[40%] top-20 h-56 w-44 rotate-[8deg] rounded-[2rem] border border-blue-300/20 bg-blue-500/[0.08] shadow-[0_0_60px_rgba(59,130,246,0.18)] backdrop-blur-xl" />
          <div className="absolute left-[28%] top-10 h-64 w-52 rotate-[5deg] rounded-[2rem] border border-blue-300/30 bg-blue-500/[0.10] shadow-[0_0_70px_rgba(37,99,235,0.22)] backdrop-blur-xl" />
          <div className="absolute left-10 top-0 flex h-72 w-60 -rotate-[4deg] items-center justify-center rounded-[2rem] border border-blue-300/50 bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-slate-950/80 shadow-[0_30px_90px_rgba(37,99,235,0.35),0_0_0_1px_rgba(255,255,255,0.08)_inset] backdrop-blur-xl">
            <Image
              src={logoSrc}
              alt=""
              width={118}
              height={118}
              className="h-28 w-28 object-contain drop-shadow-[0_0_38px_rgba(59,130,246,0.9)]"
            />
          </div>
          <div className="absolute bottom-8 left-14 h-2 w-52 rounded-full bg-blue-500/30 blur-xl" />
        </div>
      </div>

      <div className="relative z-10 max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">
          One platform. All your work.
        </p>
        <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-white xl:text-6xl">
          Manage projects.
          <br />
          Deliver{" "}
          <span className="bg-gradient-to-r from-blue-300 via-blue-500 to-violet-400 bg-clip-text text-transparent">
            results.
          </span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-8 text-slate-300">
          Plan, track, and collaborate with your team from start to finish.
        </p>
      </div>

      <div className="relative z-10 grid gap-6 sm:grid-cols-3">
        <FeatureItem
          icon={<Layers3 className="h-5 w-5" />}
          title="All in one"
          description="Projects, tasks, docs and more."
        />
        <FeatureItem
          icon={<Users className="h-5 w-5" />}
          title="Built for teams"
          description="Collaborate and get things done."
        />
        <FeatureItem
          icon={<BarChart3 className="h-5 w-5" />}
          title="Data-driven"
          description="Insights that help you make better decisions."
        />
      </div>
    </section>
  );
}

function AuthField({
  label,
  icon,
  children,
  action,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <label className="text-sm font-medium text-white">{label}</label>
        {action}
      </div>
      <div className="group flex min-h-[68px] items-center gap-4 rounded-2xl border border-white/12 bg-white/[0.035] px-5 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] transition focus-within:border-blue-400/70 focus-within:bg-white/[0.055] focus-within:shadow-[0_0_34px_rgba(59,130,246,0.18)]">
        <div className="text-slate-400 transition group-focus-within:text-blue-300">
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    const inviteEmail = params.get("email");
    if (next?.startsWith("/")) setNextPath(next);
    if (inviteEmail) setEmail(inviteEmail);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 60;
        toast.error(
          `Too many login attempts. Please try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`,
        );
      } else if (!res.ok) {
        toast.error(body.error || "Could not sign in. Check your email and password, then try again.");
      } else {
        router.push(nextPath);
        router.refresh();
      }
    } catch {
      toast.error("Could not reach Up Flow. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#030712] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_10%,rgba(37,99,235,0.16),transparent_34%),radial-gradient(circle_at_88%_82%,rgba(139,92,246,0.12),transparent_34%)]" />
      <LoginControlBar />

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[minmax(0,0.96fr)_minmax(480px,1fr)]">
        <BrandPanel />

        <section className="flex min-h-dvh items-center justify-center px-5 py-24 sm:px-8 lg:px-12">
          <div className="w-full max-w-xl">
            <div className="mb-12 text-center">
              <Image
                src={logoSrc}
                alt="Up Flow"
                width={86}
                height={86}
                priority
                className="mx-auto h-20 w-20 object-contain drop-shadow-[0_0_34px_rgba(59,130,246,0.65)]"
              />
              <h2 className="mt-6 text-4xl font-bold tracking-tight text-white">Up Flow</h2>
              <p className="mt-3 text-lg text-slate-400">Welcome back! Please sign in to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-7">
              <AuthField label="Email address" icon={<Mail className="h-6 w-6" />}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@upflow.io"
                  autoComplete="email"
                  className="h-full min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-slate-500"
                />
              </AuthField>

              <AuthField
                label="Password"
                icon={<LockKeyhole className="h-6 w-6" />}
                action={
                  <Link
                    href="/auth/forgot"
                    className="text-sm font-medium text-blue-400 transition hover:text-blue-200"
                  >
                    Forgot password?
                  </Link>
                }
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="************"
                  autoComplete="current-password"
                  className="h-full min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-slate-500"
                />
              </AuthField>

              <button
                type="submit"
                disabled={loading}
                className="group flex min-h-[68px] w-full items-center justify-center gap-4 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-violet-500 px-6 text-lg font-bold text-white shadow-[0_18px_55px_rgba(37,99,235,0.38)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(79,70,229,0.46)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-6 w-6 transition group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            <div className="my-10 grid grid-cols-[1fr_auto_1fr] items-center gap-6 text-sm uppercase tracking-[0.2em] text-slate-600">
              <span className="h-px bg-white/10" />
              <span>Or</span>
              <span className="h-px bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => toast("Google sign-in is not configured yet. Use email and password for now.")}
              className="flex min-h-[62px] w-full items-center justify-center gap-4 rounded-2xl border border-white/12 bg-white/[0.025] px-6 text-base font-semibold text-white transition hover:border-blue-400/40 hover:bg-white/[0.055]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-bold text-blue-600">
                G
              </span>
              Continue with Google
            </button>

            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-center text-slate-400">
              <div className="mb-2 flex justify-center text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              Need access? Ask your workspace admin to invite you.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
