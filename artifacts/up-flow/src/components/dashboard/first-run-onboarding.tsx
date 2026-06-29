"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Building2,
  CheckCircle2,
  FolderKanban,
  LayoutTemplate,
  ListChecks,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

type WorkspaceSetup = {
  spaces: number;
  projects: number;
  clients: number;
  members: number;
  role: "owner" | "admin" | "member" | "guest" | null;
};

type SetupStep = {
  key: string;
  title: string;
  body: string;
  href?: string;
  action?: () => void;
  complete: boolean;
  icon: ReactNode;
};

interface FirstRunOnboardingProps {
  setup?: WorkspaceSetup;
  onCreateProject: () => void;
  onInviteTeam: () => void;
  onCreateClient: () => void;
}

export function FirstRunOnboarding({
  setup,
  onCreateProject,
  onInviteTeam,
  onCreateClient,
}: FirstRunOnboardingProps) {
  const { t } = useLanguage();
  const role = setup?.role ?? null;
  const canManageWorkspace = role === "owner" || role === "admin";
  const spaces = setup?.spaces ?? 0;
  const projects = setup?.projects ?? 0;
  const clients = setup?.clients ?? 0;
  const members = setup?.members ?? 0;
  const shouldShow = spaces === 0 || projects === 0 || clients === 0;

  if (!shouldShow) return null;

  const steps: SetupStep[] = [
    {
      key: "space",
      title: t("onboarding.stepSpace"),
      body: t("onboarding.stepSpaceBody"),
      complete: spaces > 0,
      icon: <FolderKanban className="h-4 w-4" />,
    },
    {
      key: "project",
      title: t("onboarding.stepProject"),
      body: t("onboarding.stepProjectBody"),
      action: onCreateProject,
      complete: projects > 0,
      icon: <ListChecks className="h-4 w-4" />,
    },
    {
      key: "invite",
      title: t("onboarding.stepInvite"),
      body: t("onboarding.stepInviteBody"),
      action: onInviteTeam,
      complete: members > 1,
      icon: <Users className="h-4 w-4" />,
    },
    {
      key: "client",
      title: t("onboarding.stepClient"),
      body: t("onboarding.stepClientBody"),
      action: onCreateClient,
      complete: clients > 0,
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      key: "template",
      title: t("onboarding.stepTemplate"),
      body: t("onboarding.stepTemplateBody"),
      href: "/templates",
      complete: false,
      icon: <LayoutTemplate className="h-4 w-4" />,
    },
    {
      key: "permissions",
      title: t("onboarding.stepPermissions"),
      body: t("onboarding.stepPermissionsBody"),
      href: "/settings/permissions",
      complete: false,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  return (
    <section className="command-section-panel overflow-hidden rounded-[1.4rem] p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-sky-400 to-upflow-success" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("onboarding.eyebrow")}
          </p>
          <h2 className="mt-2 text-xl font-bold text-foreground">
            {t("onboarding.title")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {t("onboarding.subtitle")}
          </p>
          <div className="mt-4 rounded-2xl border border-blue-300/15 bg-blue-500/[0.06] p-3 text-xs leading-5 text-blue-100/80">
            {canManageWorkspace
              ? t("onboarding.roleHintAdmin")
              : t("onboarding.roleHintViewer")}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {steps.map((step) => (
              <SetupStepItem
                key={step.key}
                step={step}
                disabled={!canManageWorkspace && Boolean(step.action)}
                actionLabel={
                  step.key === "space"
                    ? t("onboarding.stepSpaceAction")
                    : t("onboarding.openStep")
                }
                completeLabel={t("onboarding.complete")}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("onboarding.modelTitle")}
          </p>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <ModelLine text={t("onboarding.modelWorkspace")} />
            <ModelLine text={t("onboarding.modelSpace")} />
            <ModelLine text={t("onboarding.modelProject")} />
            <ModelLine text={t("onboarding.modelTask")} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SetupStepItem({
  step,
  disabled,
  actionLabel,
  completeLabel,
}: {
  step: SetupStep;
  disabled: boolean;
  actionLabel: string;
  completeLabel: string;
}) {
  const content = (
    <>
      <span
        className={cn(
          "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border",
          step.complete
            ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
            : "border-blue-300/15 bg-blue-500/10 text-blue-100",
        )}
      >
        {step.complete ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {step.title}
          {step.complete ? (
            <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
              {completeLabel}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {step.body}
        </span>
        {!step.complete ? (
          <span className="mt-2 block text-[11px] font-semibold text-primary">
            {actionLabel}
          </span>
        ) : null}
      </span>
    </>
  );

  const className = cn(
    "flex min-h-[104px] w-full gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition-all",
    !disabled && !step.complete
      ? "hover:border-primary/35 hover:bg-primary/10 hover:shadow-[0_0_24px_rgba(59,130,246,0.14)]"
      : "",
    disabled ? "cursor-not-allowed opacity-70" : "",
  );

  if (step.action && !disabled && !step.complete) {
    return (
      <button type="button" onClick={step.action} className={className}>
        {content}
      </button>
    );
  }

  if (step.href && !disabled && !step.complete) {
    return (
      <Link href={step.href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function ModelLine({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-upflow-success" />
      <span>{text}</span>
    </div>
  );
}
