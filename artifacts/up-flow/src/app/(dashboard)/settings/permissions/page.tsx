"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Header from "@/components/layout/header";
import { useAppUser } from "@/components/user-provider";
import {
  permissionLevelLabels,
  permissionMatrixSections,
  permissionRoles,
  type PermissionLevel,
} from "@/lib/permission-matrix";
import { cn } from "@/lib/utils";

const levelIcon: Record<PermissionLevel, typeof CheckCircle2> = {
  manage: CheckCircle2,
  view: Eye,
  none: XCircle,
  owner_only: Lock,
};

const levelClass: Record<PermissionLevel, string> = {
  manage: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  view: "border-sky-400/25 bg-sky-500/10 text-sky-300",
  none: "border-border bg-muted/30 text-muted-foreground dark:border-white/10 dark:bg-white/[0.15]",
  owner_only: "border-amber-400/25 bg-amber-500/10 text-amber-300",
};

export default function PermissionsPage() {
  const user = useAppUser();
  const currentRole = user?.isSuperAdmin ? "Super admin" : user?.currentRole ?? "No active role";

  return (
    <>
      <Header title="Permission matrix" />
      <main className="mx-auto w-full max-w-6xl space-y-5 overflow-x-hidden p-4 sm:p-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-lg dark:border-blue-300/[0.15] dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.18),rgba(15,23,42,0.94))] dark:shadow-[0_0_40px_rgba(37,99,235,0.12)]">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to settings
          </Link>
          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/[0.15] text-blue-700 ring-1 ring-blue-400/30 dark:text-blue-100 dark:ring-blue-300/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h1 className="mt-5 text-3xl font-bold text-foreground">Workspace permission matrix</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Admins and owners can operate the workspace. Members and guests can view workspace records without changing data.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 dark:border-white/10 dark:bg-white/[0.15]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Current role
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-foreground">{currentRole}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {permissionRoles.map((role) => (
            <article key={role.id} className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-card/70">
              <p className="text-sm font-semibold text-foreground">{role.label}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{role.description}</p>
            </article>
          ))}
        </section>

        <section className="space-y-4">
          {permissionMatrixSections.map((section) => (
            <article key={section.title} className="overflow-hidden rounded-2xl border border-border bg-card dark:border-white/10 dark:bg-card/70">
              <div className="border-b border-border p-4 dark:border-white/10">
                <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.14em] text-muted-foreground dark:border-white/10">
                    <tr>
                      <th className="w-[34%] px-4 py-3 font-semibold">Capability</th>
                      {permissionRoles.map((role) => (
                        <th key={role.id} className="px-4 py-3 font-semibold">{role.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.capabilities.map((capability) => (
                      <tr key={capability.label} className="border-b border-border/60 last:border-0 dark:border-white/5">
                        <td className="px-4 py-4 align-top">
                          <p className="font-medium text-foreground">{capability.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{capability.detail}</p>
                        </td>
                        {permissionRoles.map((role) => (
                          <td key={role.id} className="px-4 py-4 align-top">
                            <PermissionPill level={capability.levels[role.id]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}

function PermissionPill({ level }: { level: PermissionLevel }) {
  const Icon = levelIcon[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", levelClass[level])}>
      <Icon className="h-3.5 w-3.5" />
      {permissionLevelLabels[level]}
    </span>
  );
}
