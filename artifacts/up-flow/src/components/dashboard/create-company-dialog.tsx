"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  Globe2,
  Mail,
  Megaphone,
  NotebookText,
  Phone,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Department, TeamMember } from "@/lib/types";

export type Company = {
  id: string;
  name: string;
  website?: string | null;
  description?: string | null;
  status?: string;
  service_type?: string | null;
  plan_name?: string | null;
  billing_cycle?: string | null;
  included_services?: string[] | null;
  created_at: string;
};

type WorkspaceResponse = {
  current_workspace_id?: string | null;
};

const INDUSTRY_OPTIONS = ["SaaS", "E-commerce", "Local business", "Health", "Education", "Finance", "Real estate", "Other"];
const SERVICE_TYPE_OPTIONS = ["Paid media", "Social media", "Creative production", "SEO", "Web design", "Consulting", "Full service", "Other"];
const PLAN_OPTIONS = ["Starter", "Growth", "Scale", "Enterprise", "Project", "Retainer", "Other"];
const BILLING_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
  { value: "project", label: "Per project" },
];
const SERVICE_OPTIONS = [
  "Meta Ads",
  "Google Ads",
  "Creative approvals",
  "Monthly report",
  "Social Media",
  "Content calendar",
  "Video production",
  "Landing page",
  "SEO",
  "Email marketing",
];

async function readApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function SelectIcon({ className }: { className?: string }) {
  return <ChevronDown className={cn("pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-100/60", className)} />;
}

function getSelectValue(value: string, options: string[], custom: boolean) {
  if (custom) return "Other";
  if (!value) return "";
  return options.includes(value) ? value : "Other";
}

export default function CreateCompanyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (c: Company) => void;
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [planName, setPlanName] = useState("");
  const [customIndustry, setCustomIndustry] = useState(false);
  const [customServiceType, setCustomServiceType] = useState(false);
  const [customPlanName, setCustomPlanName] = useState(false);
  const [billingCycle, setBillingCycle] = useState("");
  const [includedServices, setIncludedServices] = useState<string[]>(["Meta Ads", "Creative approvals", "Monthly report"]);
  const [servicePick, setServicePick] = useState("");
  const [customService, setCustomService] = useState("");
  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingOptions(true);
    fetch("/api/workspaces")
      .then((res) => res.json() as Promise<WorkspaceResponse>)
      .then(async (workspace) => {
        if (cancelled) return;
        const currentWorkspaceId = workspace.current_workspace_id ?? null;
        setWorkspaceId(currentWorkspaceId);

        const [usersRes, departmentsRes] = await Promise.all([
          fetch(currentWorkspaceId ? `/api/users?workspace_id=${currentWorkspaceId}&status=active` : "/api/users?status=active"),
          currentWorkspaceId
            ? fetch(`/api/workspaces/${currentWorkspaceId}/departments`)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;
        if (usersRes.ok) {
          const users = (await usersRes.json()) as { items?: TeamMember[] };
          setTeamMembers(users.items ?? []);
        }
        if (departmentsRes?.ok) {
          const departmentData = (await departmentsRes.json()) as { items?: Department[] };
          setDepartments(departmentData.items ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load team options");
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedDepartmentName = useMemo(
    () => departments.find((department) => department.id === departmentId)?.name ?? "",
    [departmentId, departments],
  );

  const filteredAssignees = useMemo(() => {
    if (!departmentId) return teamMembers;
    return teamMembers.filter((member) => member.department_id === departmentId);
  }, [departmentId, teamMembers]);

  useEffect(() => {
    if (assigneeId && filteredAssignees.every((member) => member.id !== assigneeId)) {
      setAssigneeId("");
    }
  }, [assigneeId, filteredAssignees]);

  if (!open) return null;

  const addService = (value: string) => {
    const service = value.trim();
    if (!service || includedServices.includes(service)) return;
    setIncludedServices((prev) => [...prev, service]);
    setServicePick("");
    setCustomService("");
  };

  const removeService = (service: string) => {
    setIncludedServices((prev) => prev.filter((item) => item !== service));
  };

  const reset = () => {
    setName("");
    setDomain("");
    setIndustry("");
    setServiceType("");
    setPlanName("");
    setCustomIndustry(false);
    setCustomServiceType(false);
    setCustomPlanName(false);
    setBillingCycle("");
    setIncludedServices(["Meta Ads", "Creative approvals", "Monthly report"]);
    setServicePick("");
    setCustomService("");
    setNotes("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setContactRole("");
    setDepartmentId("");
    setAssigneeId("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          website: domain.trim()
            ? /^https?:\/\//i.test(domain.trim())
              ? domain.trim()
              : `https://${domain.trim()}`
            : null,
          industry: industry.trim() || null,
          service_type: serviceType.trim() || null,
          plan_name: planName.trim() || null,
          billing_cycle: billingCycle.trim() || null,
          included_services: includedServices,
          notes: notes.trim() || null,
          description: notes.trim() || null,
          owner_id: assigneeId || null,
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_role: contactRole.trim() || null,
          responsible_department_id: departmentId || null,
          responsible_department_name: selectedDepartmentName || null,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to create company"));
      const company = (await res.json()) as Company;
      toast.success(`Created ${company.name}`);
      onCreated?.(company);
      reset();
      onClose();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("upflow:sidebar-refresh"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create company");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "h-16 w-full rounded-2xl border border-blue-200/16 bg-[#12192a]/86 pl-14 pr-4 text-base text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-blue-100/45 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/70 focus:shadow-[0_0_24px_rgba(59,130,246,0.32)]";
  const textareaClass =
    "min-h-28 w-full rounded-2xl border border-blue-200/16 bg-[#12192a]/86 px-14 py-4 text-base text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-blue-100/45 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/70 focus:shadow-[0_0_24px_rgba(59,130,246,0.32)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#020617]/72 p-4 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="relative my-6 max-h-[calc(100dvh-48px)] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-blue-200/35 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.23),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,8,23,0.98))] p-6 shadow-[0_32px_90px_rgba(0,0,0,0.62),0_0_0_1px_rgba(96,165,250,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-9 lg:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-8 flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-amber-300/35 bg-amber-400/10 text-upflow-warning shadow-[0_0_32px_rgba(245,158,11,0.22),inset_0_1px_0_rgba(255,255,255,0.1)]">
              <Building2 className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <h2 className="text-3xl font-bold tracking-tight text-white">Create company</h2>
              <p className="mt-2 text-base text-blue-100/62">
                Add a new client organization to manage campaigns, ownership, contacts, and billing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-blue-100/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close create company dialog"
          >
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="space-y-6">
          <Field label="Name" required>
            <div className="relative">
              <FieldIcon icon={<Building2 className="h-5 w-5" />} />
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                className={fieldClass}
              />
            </div>
          </Field>

          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Domain">
              <div className="relative">
                <FieldIcon icon={<Globe2 className="h-5 w-5" />} />
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="acme.com"
                  className={fieldClass}
                />
              </div>
            </Field>
            <Field label="Industry">
              <div className="relative">
                <FieldIcon icon={<BriefcaseBusiness className="h-5 w-5" />} />
                <select
                  value={getSelectValue(industry, INDUSTRY_OPTIONS, customIndustry)}
                  onChange={(e) => {
                    const isCustom = e.target.value === "Other";
                    setCustomIndustry(isCustom);
                    setIndustry(isCustom ? "" : e.target.value);
                  }}
                  className={cn(fieldClass, "appearance-none")}
                >
                  <option value="">Not set</option>
                  {INDUSTRY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <SelectIcon />
              </div>
              {customIndustry && (
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Custom industry"
                  className="mt-3 h-12 w-full rounded-xl border border-blue-200/16 bg-[#12192a]/86 px-4 text-sm text-foreground outline-none focus:border-blue-400"
                />
              )}
            </Field>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Service type">
              <div className="relative">
                <FieldIcon icon={<Megaphone className="h-5 w-5" />} />
                <select
                  value={getSelectValue(serviceType, SERVICE_TYPE_OPTIONS, customServiceType)}
                  onChange={(e) => {
                    const isCustom = e.target.value === "Other";
                    setCustomServiceType(isCustom);
                    setServiceType(isCustom ? "" : e.target.value);
                  }}
                  className={cn(fieldClass, "appearance-none")}
                >
                  <option value="">Not set</option>
                  {SERVICE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <SelectIcon />
              </div>
              {customServiceType && (
                <input
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  placeholder="Custom service type"
                  className="mt-3 h-12 w-full rounded-xl border border-blue-200/16 bg-[#12192a]/86 px-4 text-sm text-foreground outline-none focus:border-blue-400"
                />
              )}
            </Field>
            <Field label="Plan">
              <div className="relative">
                <FieldIcon icon={<TrendingUp className="h-5 w-5" />} />
                <select
                  value={getSelectValue(planName, PLAN_OPTIONS, customPlanName)}
                  onChange={(e) => {
                    const isCustom = e.target.value === "Other";
                    setCustomPlanName(isCustom);
                    setPlanName(isCustom ? "" : e.target.value);
                  }}
                  className={cn(fieldClass, "appearance-none")}
                >
                  <option value="">Not set</option>
                  {PLAN_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <SelectIcon />
              </div>
              {customPlanName && (
                <input
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Custom plan"
                  className="mt-3 h-12 w-full rounded-xl border border-blue-200/16 bg-[#12192a]/86 px-4 text-sm text-foreground outline-none focus:border-blue-400"
                />
              )}
            </Field>
          </div>

          <Field label="Billing cycle">
            <div className="relative">
              <FieldIcon icon={<RefreshCcw className="h-5 w-5" />} />
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className={cn(fieldClass, "appearance-none")}
              >
                {BILLING_OPTIONS.map((option) => (
                  <option key={option.value || "not-set"} value={option.value}>{option.label}</option>
                ))}
              </select>
              <SelectIcon />
            </div>
          </Field>

          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="Responsible department">
              <div className="relative">
                <FieldIcon icon={<Users className="h-5 w-5" />} />
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className={cn(fieldClass, "appearance-none")}
                  disabled={loadingOptions}
                >
                  <option value="">Not assigned</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
                <SelectIcon />
              </div>
            </Field>
            <Field label="Assignee / owner">
              <div className="relative">
                <FieldIcon icon={<UserRound className="h-5 w-5" />} />
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className={cn(fieldClass, "appearance-none")}
                  disabled={loadingOptions}
                >
                  <option value="">Current admin</option>
                  {filteredAssignees.map((member) => (
                    <option key={member.id} value={member.id}>{member.name || member.email}</option>
                  ))}
                </select>
                <SelectIcon />
              </div>
            </Field>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Field label="Client contact">
              <div className="relative">
                <FieldIcon icon={<UserRound className="h-5 w-5" />} />
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact name"
                  className={fieldClass}
                />
              </div>
            </Field>
            <Field label="Email">
              <div className="relative">
                <FieldIcon icon={<Mail className="h-5 w-5" />} />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="client@acme.com"
                  className={fieldClass}
                />
              </div>
            </Field>
            <Field label="Phone">
              <div className="relative">
                <FieldIcon icon={<Phone className="h-5 w-5" />} />
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                  className={fieldClass}
                />
              </div>
            </Field>
          </div>

          <Field label="Contact role">
            <div className="relative">
              <FieldIcon icon={<BriefcaseBusiness className="h-5 w-5" />} />
              <input
                value={contactRole}
                onChange={(e) => setContactRole(e.target.value)}
                placeholder="Marketing manager, decision maker, finance contact..."
                className={fieldClass}
              />
            </div>
          </Field>

          <Field label="Included services">
            <div className="rounded-2xl border border-blue-200/16 bg-[#12192a]/86 p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative">
                  <FieldIcon icon={<Sparkles className="h-5 w-5" />} />
                  <select
                    value={servicePick}
                    onChange={(e) => {
                      setServicePick(e.target.value);
                      if (e.target.value && e.target.value !== "custom") addService(e.target.value);
                    }}
                    className={cn(fieldClass, "h-14 appearance-none")}
                  >
                    <option value="">Add service from dropdown</option>
                    {SERVICE_OPTIONS.filter((option) => !includedServices.includes(option)).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                    <option value="custom">Custom service...</option>
                  </select>
                  <SelectIcon />
                </div>
                <button
                  type="button"
                  onClick={() => addService(customService)}
                  disabled={!customService.trim()}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-blue-400/35 bg-blue-500/12 px-5 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
              {servicePick === "custom" && (
                <input
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addService(customService);
                    }
                  }}
                  placeholder="Type a service and press Add"
                  className="mt-3 h-12 w-full rounded-xl border border-blue-200/16 bg-[#0d1424] px-4 text-sm text-foreground outline-none focus:border-blue-400"
                />
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {includedServices.map((service) => (
                  <span
                    key={service}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/12 px-3 py-1.5 text-sm text-blue-100"
                  >
                    {service}
                    <button
                      type="button"
                      onClick={() => removeService(service)}
                      aria-label={`Remove ${service}`}
                      className="rounded-full text-blue-100/60 hover:text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                {includedServices.length === 0 && (
                  <span className="text-sm text-blue-100/45">No services selected yet.</span>
                )}
              </div>
            </div>
          </Field>

          <Field label="Notes">
            <div className="relative">
              <FieldIcon className="top-5 translate-y-0" icon={<NotebookText className="h-5 w-5" />} />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional context, goals, access notes, billing details, or client preferences..."
                className={textareaClass}
              />
            </div>
          </Field>
        </div>

        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-16 rounded-2xl border border-white/18 bg-white/[0.02] text-base font-semibold text-foreground transition hover:bg-white/[0.07] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl border border-blue-300/40 bg-primary text-base font-bold text-primary-foreground shadow-[0_0_34px_rgba(59,130,246,0.38),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Sparkles className="h-5 w-5" />
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>

        {!workspaceId && (
          <p className="mt-4 text-center text-xs text-blue-100/45">
            Team and department options appear after an active workspace is available.
          </p>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-blue-50/88">
        {label} {required && <span className="text-rose-300">*</span>}
      </span>
      {children}
    </label>
  );
}

function FieldIcon({
  icon,
  className,
}: {
  icon: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("absolute left-5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-blue-500/14 text-blue-300", className)}>
      {icon}
    </span>
  );
}
