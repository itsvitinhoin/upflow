"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Workflow } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import type { Department, TeamMember } from "@/lib/types";

type Mapping = {
  id: string;
  service: string;
  leader_id: string | null;
  department_id: string | null;
  active: boolean;
  leader?: { id: string; name: string; email: string } | null;
};

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
            department_id: mapping.department_id || null,
            active: mapping.active,
          })),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || t("onboardingWorkflow.mappingSaveFailed"));
      }
      toast.success(t("onboardingWorkflow.mappingSaved"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboardingWorkflow.mappingSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
            <Workflow className="h-4 w-4" /> {t("onboardingWorkflow.mappingEyebrow")}
          </p>
          <h2 className="mt-2 text-xl font-bold text-foreground">{t("onboardingWorkflow.mappingTitle")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("onboardingWorkflow.mappingBody")}</p>
        </div>
        {isAdmin && (
          <button
            onClick={save}
            disabled={saving || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("common.save")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {mappings.map((mapping) => (
            <div key={mapping.id} className="grid gap-2 rounded-xl border border-blue-300/10 bg-white/[0.03] p-3 sm:grid-cols-[1fr_180px_180px] sm:items-center">
              <div>
                <p className="text-sm font-semibold text-foreground">{mapping.service}</p>
                <p className="text-xs text-muted-foreground">
                  {mapping.leader?.name ?? t("companyDialog.notAssigned")}
                </p>
              </div>
              <select
                value={mapping.department_id ?? ""}
                disabled={!isAdmin}
                onChange={(event) =>
                  setMappings((current) =>
                    current.map((row) =>
                      row.service === mapping.service ? { ...row, department_id: event.target.value || null } : row,
                    ),
                  )
                }
                className="h-9 rounded-lg border border-white/10 bg-[#0b1223] px-2 text-sm text-foreground outline-none"
              >
                <option value="">{t("companyDialog.responsibleDepartment")}</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
              <select
                value={mapping.leader_id ?? ""}
                disabled={!isAdmin}
                onChange={(event) =>
                  setMappings((current) =>
                    current.map((row) =>
                      row.service === mapping.service ? { ...row, leader_id: event.target.value || null } : row,
                    ),
                  )
                }
                className="h-9 rounded-lg border border-white/10 bg-[#0b1223] px-2 text-sm text-foreground outline-none"
              >
                <option value="">{t("companyDialog.assigneeOwner")}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
