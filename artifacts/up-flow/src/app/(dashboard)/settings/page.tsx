"use client";

import Link from "next/link";
import { Activity, KeyRound, RefreshCcw, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import Header from "@/components/layout/header";
import { useLanguage } from "@/components/language-provider";

const settingsCards = [
  {
    icon: UserRound,
    titleKey: "settings.accountTitle",
    descriptionKey: "settings.accountDescription",
  },
  {
    icon: SlidersHorizontal,
    titleKey: "settings.workspaceTitle",
    descriptionKey: "settings.workspaceDescription",
    href: "/team",
    actionKey: "settings.openTeam",
  },
  {
    icon: ShieldCheck,
    titleKey: "settings.healthTitle",
    descriptionKey: "settings.healthDescription",
    href: "/admin/health",
    actionKey: "settings.openHealth",
  },
  {
    icon: KeyRound,
    titleKey: "settings.permissionsTitle",
    descriptionKey: "settings.permissionsDescription",
    href: "/settings/permissions",
    actionKey: "settings.openPermissions",
  },
  {
    icon: RefreshCcw,
    titleKey: "settings.qaResetTitle",
    descriptionKey: "settings.qaResetDescription",
    href: "/settings/qa-reset",
    actionKey: "settings.openQaReset",
  },
];

export default function SettingsPage() {
  const { t } = useLanguage();

  return (
    <>
      <Header title={t("settings.title")} />
      <main className="mx-auto w-full max-w-5xl space-y-5 overflow-x-hidden p-4 sm:p-6">
        <section className="relative overflow-hidden rounded-3xl border border-blue-300/15 bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(124,58,237,0.14),rgba(15,23,42,0.92))] p-6 shadow-[0_0_40px_rgba(37,99,235,0.12)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.25),transparent_36%),radial-gradient(circle_at_0%_100%,rgba(14,165,233,0.16),transparent_34%)]" />
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-100 ring-1 ring-blue-300/20">
              <Activity className="h-5 w-5" />
            </div>
            <h1 className="mt-5 text-3xl font-bold text-foreground">{t("settings.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("settings.subtitle")}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {settingsCards.map((card) => {
            const Icon = card.icon;
            const content = (
              <div className="group h-full rounded-2xl border border-white/10 bg-card/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:-translate-y-0.5 hover:border-blue-300/25 hover:shadow-[0_0_30px_rgba(37,99,235,0.12)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-foreground">{t(card.titleKey)}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t(card.descriptionKey)}
                </p>
                {card.actionKey ? (
                  <p className="mt-4 text-xs font-semibold text-primary group-hover:text-blue-200">
                    {t(card.actionKey)}
                  </p>
                ) : null}
              </div>
            );

            return card.href ? (
              <Link key={card.titleKey} href={card.href}>
                {content}
              </Link>
            ) : (
              <div key={card.titleKey}>{content}</div>
            );
          })}
        </section>
      </main>
    </>
  );
}
