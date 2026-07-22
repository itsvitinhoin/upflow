"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Building2, ClipboardCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import BrazilianDateInput from "@/components/ui/brazilian-date-input";
import { useLanguage } from "@/components/language-provider";
import type { Company } from "@/lib/types";

type Props = {
  open: boolean;
  companyId: string;
  company?: Partial<Company> | null;
  onClose: () => void;
  onStarted?: () => void | Promise<void>;
};

type ClientWizardResponse = {
  missing_mappings?: string[];
};

const BRAND_TYPES = ["B2B", "B2C"];

function todayInputDate() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function cleanNullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function parseServices(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((service) => service.trim())
        .filter(Boolean),
    ),
  );
}

function parseCurrencyValue(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

async function readApiError(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Starts the client-onboarding wizard for an already-created company. It
 * deliberately never includes contact fields: the wizard only creates a
 * contact when `contact_name` is sent, while this path must retain the
 * company's existing contact list unchanged.
 */
export default function StartClientOnboardingDialog({
  open,
  companyId,
  company,
  onClose,
  onStarted,
}: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [planName, setPlanName] = useState("");
  const [billingCycle, setBillingCycle] = useState("");
  const [services, setServices] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedStartDate, setExpectedStartDate] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(company?.name ?? "");
    setWebsite(company?.website ?? "");
    setIndustry(company?.industry ?? "");
    setServiceType(company?.service_type ?? "");
    setPlanName(company?.plan_name ?? "");
    setBillingCycle(company?.billing_cycle ?? "");
    setServices((company?.included_services ?? []).join(", "));
    setNotes(company?.notes ?? company?.description ?? "");
    setExpectedStartDate(todayInputDate());
    setContractValue(company?.contract_value == null ? "" : String(company.contract_value));
  }, [company, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!submitting) {
          event.preventDefault();
          onClose();
        }
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, submitting]);

  if (!open) return null;

  const contractedServices = parseServices(services);
  const selectedBrandTypeIsCustom = Boolean(serviceType && !BRAND_TYPES.includes(serviceType));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error(t("companyDialog.nameRequired"));
      return;
    }
    if (!serviceType.trim()) {
      toast.error(t("companyDialog.brandTypeRequired"));
      return;
    }
    if (contractedServices.length === 0) {
      toast.error(t("companyDialog.servicesRequired"));
      return;
    }
    if (!expectedStartDate) {
      toast.error(t("companyDialog.expectedStartRequired"));
      return;
    }

    const parsedContractValue = parseCurrencyValue(contractValue);
    if (parsedContractValue !== null && !Number.isFinite(parsedContractValue)) {
      toast.error(t("companyDialog.contractValueInvalid"));
      return;
    }

    setSubmitting(true);
    try {
      const normalizedWebsite = cleanNullable(website);
      const res = await fetch("/api/onboarding/client-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          name: name.trim(),
          website: normalizedWebsite,
          industry: cleanNullable(industry),
          service_type: serviceType.trim(),
          plan_name: cleanNullable(planName),
          billing_cycle: cleanNullable(billingCycle),
          included_services: contractedServices,
          notes: cleanNullable(notes),
          owner_id: company?.owner_id ?? null,
          expected_start_date: expectedStartDate,
          closing_date: null,
          initial_notes: cleanNullable(notes),
          responsible_salesperson_id: company?.owner_id ?? null,
          contract_value: parsedContractValue,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t("onboardingWorkflow.startFailed")));

      const result = (await res.json()) as ClientWizardResponse;
      toast.success(t("companyDialog.onboardingStarted", { name: name.trim() }));
      if ((result.missing_mappings?.length ?? 0) > 0) {
        toast.message(t("companyDialog.missingMappings", { count: result.missing_mappings?.length ?? 0 }));
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
      }
      await onStarted?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("onboardingWorkflow.startFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/5";
  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-md dark:bg-[#020617]/[0.72]"
      onClick={submitting ? undefined : onClose}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("onboardingWorkflow.start")}
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="my-6 w-full max-w-2xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl dark:border-blue-200/[0.25] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,8,23,0.98))] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 text-blue-600 dark:text-blue-200">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-foreground">{t("onboardingWorkflow.start")}</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">{company?.name ?? name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
            aria-label={t("companyDialog.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>{t("companyDialog.brandName")}</span>
            <input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("companyDialog.brandNamePlaceholder")}
              className={inputClass}
            />
          </label>

          <label>
            <span className={labelClass}>{t("companyDialog.brandType")}</span>
            <select
              required
              value={serviceType}
              onChange={(event) => setServiceType(event.target.value)}
              className={inputClass}
            >
              <option value="">{t("companyDialog.brandTypePlaceholder")}</option>
              {selectedBrandTypeIsCustom ? <option value={serviceType}>{serviceType}</option> : null}
              <option value="B2B">{t("companyDialog.brandType.b2b")}</option>
              <option value="B2C">{t("companyDialog.brandType.b2c")}</option>
            </select>
          </label>

          <label>
            <span className={labelClass}>{t("onboardingWorkflow.expectedStart")}</span>
            <BrazilianDateInput
              required
              value={expectedStartDate}
              onChange={setExpectedStartDate}
              className={inputClass}
            />
          </label>

          <label className="sm:col-span-2">
            <span className={labelClass}>{t("onboardingWorkflow.contractedServices")}</span>
            <textarea
              required
              rows={3}
              value={services}
              onChange={(event) => setServices(event.target.value)}
              placeholder={t("companyDialog.planServicesPlaceholder")}
              className={`${inputClass} resize-y`}
            />
          </label>

          <label>
            <span className={labelClass}>{t("companyDialog.contractedPlan")}</span>
            <input
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
              placeholder={t("companyDialog.planPlaceholder")}
              className={inputClass}
            />
          </label>

          <label>
            <span className={labelClass}>{t("companyDialog.contractValue")}</span>
            <input
              inputMode="decimal"
              value={contractValue}
              onChange={(event) => setContractValue(event.target.value)}
              placeholder={t("companyDialog.contractValuePlaceholder")}
              className={inputClass}
            />
          </label>

          <label className="sm:col-span-2">
            <span className={labelClass}>{t("onboardingWorkflow.initialNotes")}</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("companyDialog.notesPlaceholder")}
              className={`${inputClass} resize-y`}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-60 dark:border-white/10"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !serviceType.trim() || contractedServices.length === 0 || !expectedStartDate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            {submitting ? t("common.creating") : t("onboardingWorkflow.start")}
          </button>
        </div>
      </form>
    </div>
  );
}
