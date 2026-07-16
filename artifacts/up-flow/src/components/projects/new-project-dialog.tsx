"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import BrazilianDateInput from "@/components/ui/brazilian-date-input";
import type { Project } from "@/lib/types";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  /** Pre-fill the Space the new project should belong to. */
  defaultSpaceId?: string | null;
  /** Link the new project to a client/company. */
  defaultCompanyId?: string | null;
}

export default function NewProjectDialog({
  open,
  onClose,
  onCreated,
  defaultSpaceId,
  defaultCompanyId,
}: NewProjectDialogProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startOnboarding, setStartOnboarding] = useState(Boolean(defaultCompanyId));
  const [contractedServices, setContractedServices] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [onboardingStartDate, setOnboardingStartDate] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          due_date: dueDate || null,
          ...(defaultSpaceId ? { space_id: defaultSpaceId } : {}),
          ...(defaultCompanyId ? { company_id: defaultCompanyId } : {}),
          ...(defaultCompanyId && startOnboarding
            ? {
                start_onboarding: true,
                contracted_services: contractedServices
                  .split(/,|\r?\n/)
                  .map((item) => item.trim())
                  .filter(Boolean),
                closing_date: closingDate || null,
                onboarding_start_date: onboardingStartDate || null,
                initial_notes: initialNotes.trim() || null,
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || t("projects.failedCreate"));
      }
      const project = (await res.json()) as Project;
      setName("");
      setDescription("");
      setDueDate("");
      setStartOnboarding(Boolean(defaultCompanyId));
      setContractedServices("");
      setClosingDate("");
      setOnboardingStartDate("");
      setInitialNotes("");
      window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
      onCreated(project);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("projects.failedCreate");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("projects.newProject")}
        className="max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-md overflow-y-auto rounded-2xl p-4 glass-strong sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">{t("projects.newProject")}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("projects.projectName")} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projects.projectNamePlaceholder")}
              required
              autoFocus
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("projects.description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projects.descriptionPlaceholder")}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground backdrop-blur focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t("projects.dueDate")}
            </label>
            <BrazilianDateInput
              value={dueDate}
              onChange={setDueDate}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground backdrop-blur focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
            />
          </div>
          {defaultCompanyId && (
            <div className="rounded-xl border border-blue-300/[0.15] bg-blue-400/5 p-3">
              <label className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
                <span>{t("onboardingWorkflow.startWithProject")}</span>
                <input
                  type="checkbox"
                  checked={startOnboarding}
                  onChange={(event) => setStartOnboarding(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>
              {startOnboarding && (
                <div className="mt-3 grid gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {t("onboardingWorkflow.contractedServices")}
                    </label>
                    <textarea
                      value={contractedServices}
                      onChange={(e) => setContractedServices(e.target.value)}
                      placeholder="Meta Ads, SEO, Social Media"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {t("onboardingWorkflow.closingDate")}
                      </label>
                      <BrazilianDateInput
                        value={closingDate}
                        onChange={setClosingDate}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {t("onboardingWorkflow.expectedStart")}
                      </label>
                      <BrazilianDateInput
                        value={onboardingStartDate}
                        onChange={setOnboardingStartDate}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
                      />
                    </div>
                  </div>
                  <textarea
                    value={initialNotes}
                    onChange={(e) => setInitialNotes(e.target.value)}
                    placeholder={t("onboardingWorkflow.initialNotes")}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-white/10 dark:bg-white/5"
                  />
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent dark:border-white/10 dark:hover:bg-white/10"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? t("common.creating") : t("projects.createProject")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
