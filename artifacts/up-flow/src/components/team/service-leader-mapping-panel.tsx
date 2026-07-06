"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, Workflow } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import type { Department, TeamMember } from "@/lib/types";

type Mapping = {
  id: string;
  service: string;
  leader_id: string | null;
  backup_leader_id: string | null;
  department_id: string | null;
  active: boolean;
  leader?: { id: string; name: string; email: string } | null;
  backup_leader?: { id: string; name: string; email: string } | null;
  department?: { id: string; name: string } | null;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function ServiceLeaderMappingPanel({
  isAdmin,
  users,
  departments,
}: {
  isAdmin: boolean;
  users: TeamMember[];
  departments: Department[];
}) {
  const { t } = useLanguage();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const departmentByName = useMemo(() => {
    const entries = departments.map((department) => [normalize(department.name), department] as const);
    return new Map(entries);
  }, [departments]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/service-leader-mapping");
      if (!res.ok) throw new Error(t("onboardingWorkflow.mappingLoadFailed"));
      const data = (await res.json()) as { items?: Mapping[] };
      setMappings(data.items ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.mappingLoadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMapping = (service: string, patch: Partial<Mapping>) => {
    setMappings((current) => current.map((row) => (row.service === service ? { ...row, ...patch } : row)));
  };

  const matchingDepartmentId = (mapping: Mapping) => {
    if (mapping.department_id) return mapping.department_id;
    return departmentByName.get(normalize(mapping.service))?.id ?? null;
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/service-leader-mapping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mappings: mappings.map((mapping) => ({
            service: mapping.service,
            leader_id: mapping.leader_id || null,
            backup_leader_id: mapping.backup_leader_id || null,
            department_id: matchingDepartmentId(mapping),
            active: mapping.active,
          })),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("onboardingWorkflow.mappingSaveFailed"));
      }
      const data = (await res.json()) as { items?: Mapping[] };
      if (data.items) setMappings(data.items);
      toast.success(t("onboardingWorkflow.mappingSaved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.mappingSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const missingCount = mappings.filter((mapping) => !mapping.leader_id).length;

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
            <Workflow className="h-4 w-4" /> {t("onboardingWorkflow.mappingEyebrow")}
          </p>
          <h2 className="mt-2 text-xl font-bold text-foreground">{t("onboardingWorkflow.mappingTitle")}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("onboardingWorkflow.mappingBody")}</p>
        </div>
        {isAdmin && (
          <button
            onClick={save}
            disabled={saving || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("onboardingWorkflow.saveMapping")}
          </button>
        )}
      </div>

      {missingCount > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("onboardingWorkflow.departmentMissingResponsible")}</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-border/60 bg-background/35">
          <div className="grid grid-cols-[1.2fr_1.3fr_1.3fr_0.7fr] gap-3 border-b border-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground max-lg:hidden">
            <span>{t("onboardingWorkflow.departmentColumn")}</span>
            <span>{t("onboardingWorkflow.primaryResponsible")}</span>
            <span>{t("onboardingWorkflow.backupResponsible")}</span>
            <span>{t("onboardingWorkflow.mappingStatus")}</span>
          </div>
          <div className="divide-y divide-border/60">
            {mappings.map((mapping) => {
              const isReady = Boolean(mapping.leader_id);
              return (
                <div key={mapping.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1.2fr_1.3fr_1.3fr_0.7fr] lg:items-center">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{mapping.service}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground lg:hidden">{t("onboardingWorkflow.departmentColumn")}</p>
                  </div>
                  <label className="min-w-0">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground lg:hidden">
                      {t("onboardingWorkflow.primaryResponsible")}
                    </span>
                    <select
                      value={mapping.leader_id ?? ""}
                      disabled={!isAdmin}
                      onChange={(event) => {
                        const selected = users.find((user) => user.id === event.target.value) ?? null;
                        updateMapping(mapping.service, {
                          leader_id: event.target.value || null,
                          leader: selected ? { id: selected.id, name: selected.name, email: selected.email } : null,
                        });
                      }}
                      className="h-10 w-full min-w-0 rounded-lg border border-border/70 bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-blue-400 disabled:opacity-60"
                    >
                      <option value="">{t("companyDialog.notAssigned")}</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground lg:hidden">
                      {t("onboardingWorkflow.backupResponsible")}
                    </span>
                    <select
                      value={mapping.backup_leader_id ?? ""}
                      disabled={!isAdmin}
                      onChange={(event) => {
                        const selected = users.find((user) => user.id === event.target.value) ?? null;
                        updateMapping(mapping.service, {
                          backup_leader_id: event.target.value || null,
                          backup_leader: selected ? { id: selected.id, name: selected.name, email: selected.email } : null,
                        });
                      }}
                      className="h-10 w-full min-w-0 rounded-lg border border-border/70 bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-blue-400 disabled:opacity-60"
                    >
                      <option value="">{t("onboardingWorkflow.selectBackup")}</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                        isReady
                          ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                          : "border border-amber-400/30 bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {isReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {isReady ? t("onboardingWorkflow.mappingActive") : t("onboardingWorkflow.mappingMissing")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
