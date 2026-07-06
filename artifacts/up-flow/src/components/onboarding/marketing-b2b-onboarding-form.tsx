"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Globe2,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn, formatDate } from "@/lib/utils";

type FormValues = Record<string, string>;
type TeamUser = { id: string; name: string; email: string; avatar_url?: string | null };

type ServiceAssignment = {
  id: string;
  service: string;
  leader_id: string | null;
  department_id: string | null;
  department_name: string | null;
  status: string;
  notes: string | null;
  leader: { id: string; name: string; email: string } | null;
  department: { id: string; name: string } | null;
};

type B2BFormResponse = {
  id: string;
  status: string;
  values: FormValues;
  completed_at: string | null;
  updated_at: string | null;
  can_edit: boolean;
  task: {
    id: string;
    title: string;
    status: string;
    assignee: { id: string; name: string; email: string } | null;
    project: { id: string; name: string } | null;
  };
  company: { id: string; name: string; website: string | null; industry: string | null };
  onboarding: {
    id: string;
    workspace_id: string;
    status: string;
    progress: number;
    contracted_services: unknown;
    service_assignments?: ServiceAssignment[];
  };
  checklist_item: { id: string; status: string; completed_at: string | null; owner_id: string | null };
};

type FieldConfig = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  type?: "text" | "email" | "tel" | "url" | "number" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
  span?: "full";
};

type SectionConfig = {
  id: string;
  title: string;
  accent: "blue" | "amber" | "purple" | "pink" | "teal" | "cyan" | "green";
  fields: FieldConfig[];
};

const sections: SectionConfig[] = [
  {
    id: "brand",
    title: "Sobre a marca",
    accent: "blue",
    fields: [
      { key: "brand.name", label: "Nome da marca", icon: Building2, placeholder: "Ex: Namine" },
      { key: "brand.owner", label: "Proprietario / dono", icon: UserRound },
      { key: "brand.cnpj", label: "CNPJ", icon: ClipboardCheck },
      { key: "brand.address", label: "Endereco", icon: MapPin, span: "full" },
      { key: "brand.website", label: "Site oficial", icon: Globe2, type: "url", placeholder: "https://" },
      { key: "brand.instagram", label: "Instagram", icon: Instagram, placeholder: "@marca" },
      { key: "brand.competitors", label: "Concorrentes", icon: Target, span: "full" },
      { key: "brand.notes", label: "Observacoes gerais", icon: FileText, type: "textarea", span: "full" },
    ],
  },
  {
    id: "commercial",
    title: "Regras comerciais",
    accent: "amber",
    fields: [
      { key: "commercial.cnpjRequired", label: "CNPJ obrigatorio?", icon: ClipboardCheck, type: "select", options: ["Sim", "Nao", "Depende"] },
      { key: "commercial.minimumOrder", label: "Pedido minimo", icon: BarChart3 },
      { key: "commercial.paymentMethods", label: "Formas de pagamento", icon: ClipboardCheck },
      { key: "commercial.discountPolicy", label: "Politica de desconto", icon: ClipboardCheck },
      { key: "commercial.restrictions", label: "Restricoes", icon: ShieldCheck, span: "full" },
      { key: "commercial.sizeGrid", label: "Grade de tamanho", icon: ClipboardCheck },
      { key: "commercial.ownManufacturing", label: "Fabricacao propria?", icon: Building2, type: "select", options: ["Sim", "Nao", "Parcial"] },
      { key: "commercial.nationalShipping", label: "Envio nacional?", icon: Globe2, type: "select", options: ["Sim", "Nao", "Algumas regioes"] },
      { key: "commercial.notes", label: "Observacoes comerciais", icon: FileText, type: "textarea", span: "full" },
    ],
  },
  {
    id: "positioning",
    title: "Publico e comportamento",
    accent: "purple",
    fields: [
      { key: "positioning.brandPositioning", label: "Posicionamento da marca", icon: Target, span: "full" },
      { key: "positioning.brandStyle", label: "Estilo da marca", icon: Sparkles },
      { key: "positioning.valueProposition", label: "Proposta de valor", icon: ClipboardCheck, span: "full" },
      { key: "positioning.targetAudience", label: "Publico-alvo", icon: Users, span: "full" },
      { key: "positioning.resellerProfile", label: "Perfil lojista / revendedor", icon: Building2 },
      { key: "positioning.benchmarkLink", label: "Link pesquisa / benchmarking", icon: Globe2, type: "url" },
      { key: "positioning.buyingBehaviorNotes", label: "Observacoes comportamento de compra", icon: FileText, type: "textarea", span: "full" },
    ],
  },
];

const brandResponsibleRows = [
  ["finance", "Financeiro"],
  ["marketing", "Marketing"],
  ["commercial", "Comercial"],
  ["creativeApproval", "Aprovacao de criativos"],
  ["operations", "Operacoes"],
  ["other", "Outros"],
] as const;

const responsibleColumns = [
  ["name", "Nome"],
  ["role", "Cargo"],
  ["phone", "WhatsApp / Telefone"],
  ["email", "E-mail"],
  ["note", "Link / Observacao"],
] as const;

const accessRows = [
  ["vestiUpZero", "Vesti / UP Zero"],
  ["dashboard", "Acesso ao dashboard"],
  ["dashboardLink", "Link do dashboard"],
  ["metaAds", "Meta Ads"],
  ["googleAds", "Google Ads"],
  ["ga4Gtm", "GA4 / GTM"],
  ["ecommercePlatform", "Plataforma de e-commerce"],
  ["domainDns", "Dominio / DNS"],
  ["driveFolder", "Drive / materiais"],
  ["otherAccess", "Outros acessos"],
] as const;

const accessStatusOptions = ["Concedido", "Pendente", "Parcial", "Bloqueado", "Nao se aplica"];
const accentClasses = {
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  amber: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  purple: "border-purple-400/40 bg-purple-500/10 text-purple-300",
  pink: "border-pink-400/40 bg-pink-500/10 text-pink-300",
  teal: "border-teal-400/40 bg-teal-500/10 text-teal-300",
  cyan: "border-cyan-400/40 bg-cyan-500/10 text-cyan-300",
  green: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
};

function getValue(values: FormValues, key: string) {
  return values[key] ?? "";
}

function isFilled(values: FormValues, key: string) {
  return Boolean(getValue(values, key).trim());
}

function initials(name: string | null | undefined) {
  const result = (name ?? "UP")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return result || "UP";
}

function parseServices(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("concedido") || normalized.includes("complete") || normalized.includes("assigned")) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  }
  if (normalized.includes("bloqueado") || normalized.includes("needs")) return "border-red-400/30 bg-red-500/10 text-red-300";
  if (normalized.includes("parcial")) return "border-cyan-400/30 bg-cyan-500/10 text-cyan-300";
  return "border-amber-400/30 bg-amber-500/10 text-amber-300";
}

export default function MarketingB2BOnboardingForm({
  taskId,
  onClose,
  onUpdate,
  embedded = false,
}: {
  taskId: string;
  onClose?: () => void;
  onUpdate?: () => void;
  embedded?: boolean;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState<B2BFormResponse | null>(null);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [activeTab, setActiveTab] = useState<"form" | "kanban">("form");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    brand: true,
    commercial: true,
    positioning: true,
    brandResponsibles: true,
    upResponsibles: true,
    access: true,
    validation: true,
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadForm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/onboarding/marketing-b2b-form/${taskId}`);
      if (!res.ok) throw new Error(t("marketingB2BForm.loadFailed"));
      const data = (await res.json()) as B2BFormResponse;
      setForm(data);
      if (data.onboarding.workspace_id) {
        const usersRes = await fetch(`/api/users?workspace_id=${data.onboarding.workspace_id}&status=active&limit=500`);
        if (usersRes.ok) {
          const usersData = (await usersRes.json()) as { items?: TeamUser[] };
          setTeamUsers(usersData.items ?? []);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("marketingB2BForm.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [taskId, t]);

  useEffect(() => {
    void loadForm();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [loadForm]);

  const values = form?.values ?? {};
  const assignments = form?.onboarding.service_assignments ?? [];
  const contractedServices = parseServices(form?.onboarding.contracted_services);

  const plainFieldKeys = useMemo(() => sections.flatMap((section) => section.fields.map((field) => field.key)), []);
  const brandResponsibleKeys = useMemo(
    () => brandResponsibleRows.flatMap(([rowKey]) => responsibleColumns.map(([columnKey]) => `brandResponsible.${rowKey}.${columnKey}`)),
    [],
  );
  const accessKeys = useMemo(() => accessRows.flatMap(([rowKey]) => [`access.${rowKey}.status`, `access.${rowKey}.notes`]), []);
  const totalFields = plainFieldKeys.length + brandResponsibleKeys.length + accessKeys.length + Math.max(assignments.length, 1);
  const completedFields =
    plainFieldKeys.filter((key) => isFilled(values, key)).length +
    brandResponsibleKeys.filter((key) => isFilled(values, key)).length +
    accessKeys.filter((key) => isFilled(values, key)).length +
    assignments.filter((assignment) => Boolean(assignment.leader_id)).length;
  const progress = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  const sectionProgress = [
    ...sections.map((section) => ({
      id: section.id,
      title: section.title,
      done: section.fields.filter((field) => isFilled(values, field.key)).length,
      total: section.fields.length,
    })),
    {
      id: "brandResponsibles",
      title: "Responsaveis da marca",
      done: brandResponsibleRows.filter(([rowKey]) => responsibleColumns.some(([columnKey]) => isFilled(values, `brandResponsible.${rowKey}.${columnKey}`))).length,
      total: brandResponsibleRows.length,
    },
    {
      id: "upResponsibles",
      title: "Responsaveis UP por servico",
      done: assignments.filter((assignment) => Boolean(assignment.leader_id)).length,
      total: Math.max(assignments.length, 1),
    },
    {
      id: "access",
      title: "Acessos",
      done: accessRows.filter(([rowKey]) => isFilled(values, `access.${rowKey}.status`)).length,
      total: accessRows.length,
    },
  ];
  const nextAction = sectionProgress.find((section) => section.done < section.total);

  const savePatch = useCallback(
    async (payload: { field?: string; value?: string; values?: FormValues; finalize?: boolean }) => {
      if (!form?.can_edit) return;
      setSaving(true);
      setSaveState("saving");
      try {
        const res = await fetch(`/api/onboarding/marketing-b2b-form/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || t("marketingB2BForm.saveFailed"));
        }
        const data = (await res.json()) as B2BFormResponse;
        setForm(data);
        setSaveState("saved");
        onUpdate?.();
      } catch (err) {
        setSaveState("idle");
        toast.error(err instanceof Error ? err.message : t("marketingB2BForm.saveFailed"));
      } finally {
        setSaving(false);
      }
    },
    [form?.can_edit, onUpdate, taskId, t],
  );

  const updateField = (field: string, value: string) => {
    setForm((current) => (current ? { ...current, values: { ...current.values, [field]: value } } : current));
    if (!form?.can_edit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => void savePatch({ field, value }), 650);
  };

  const finalize = async () => {
    if (!form?.can_edit) return;
    await savePatch({ values: form.values, finalize: true });
    toast.success("Onboarding B2B finalizado");
  };

  const updateServiceLeader = async (assignment: ServiceAssignment, leaderId: string) => {
    if (!form?.can_edit) return;
    try {
      const res = await fetch(`/api/onboarding/${form.onboarding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_assignment: {
            service: assignment.service,
            leader_id: leaderId || null,
            department_id: assignment.department_id,
            notes: assignment.notes,
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Nao foi possivel salvar o responsavel do servico");
      }
      toast.success("Responsavel do servico salvo");
      await loadForm();
      onUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel salvar o responsavel do servico");
    }
  };

  const toggleSection = (id: string) => setOpenSections((current) => ({ ...current, [id]: !current[id] }));

  if (loading) {
    return (
      <div className={cn("flex min-h-[420px] items-center justify-center bg-[#020817] text-slate-200", !embedded && "fixed inset-0 z-50")}>
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }
  if (!form) return null;

  const assigneeName = form.task.assignee?.name ?? "Sem responsavel";
  const updatedAt = form.updated_at ?? form.completed_at;

  return (
    <div className={cn(!embedded && "fixed inset-0 z-50 overflow-y-auto bg-[#020817]", embedded && "w-full")}>
      <div className="min-h-screen bg-[#020817] px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1560px]">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-[#06101f] px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-400">Buscar marketing b2b onboarding, projetos, tarefas, docs...</p>
            </div>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Ctrl K</span>
            {onClose && (
              <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800" title="Fechar">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <main className="min-w-0 space-y-5">
              <section className="rounded-2xl border border-slate-800 bg-[#06101f] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <button onClick={onClose} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-blue-300" type="button">
                      <ArrowLeft className="h-4 w-4" /> Voltar para Marketing B2B
                    </button>
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Marketing B2B Onboarding</h1>
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                        {form.status === "complete" ? "Concluido" : "Active"}
                      </span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">Formulario e execucao do onboarding para novos clientes de Marketing B2B.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-bold text-slate-200 hover:border-blue-400/60">
                      <FileText className="h-4 w-4" /> Docs
                    </button>
                    <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-[0_14px_34px_rgba(37,99,235,0.35)]">
                      <CalendarDays className="h-4 w-4" /> Adicionar tarefa
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-slate-800 pt-4 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoBlock label="Cliente" value={form.company.name} />
                  <InfoBlock label="Responsavel" value={assigneeName} avatar={initials(assigneeName)} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500">Progresso geral</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2 min-w-0 flex-1 rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-sm font-black text-white">{progress}%</span>
                    </div>
                  </div>
                  <InfoBlock label="Ultima atualizacao" value={updatedAt ? formatDate(updatedAt) : "-"} />
                </div>
              </section>

              <div className="flex border-b border-slate-800">
                <TabButton active={activeTab === "form"} onClick={() => setActiveTab("form")} icon={ClipboardCheck} label="Formulario de Onboarding" />
                <TabButton active={activeTab === "kanban"} onClick={() => setActiveTab("kanban")} icon={BarChart3} label="Kanban / Tarefas" />
              </div>
              {activeTab === "form" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {sections.map((section, index) => (
                    <FormSection
                      key={section.id}
                      index={index + 1}
                      section={section}
                      values={values}
                      open={openSections[section.id]}
                      canEdit={form.can_edit}
                      onToggle={() => toggleSection(section.id)}
                      onChange={updateField}
                    />
                  ))}
                  <ResponsibleBrandSection open={openSections.brandResponsibles} values={values} canEdit={form.can_edit} onToggle={() => toggleSection("brandResponsibles")} onChange={updateField} />
                  <UpResponsibleSection open={openSections.upResponsibles} assignments={assignments} teamUsers={teamUsers} canEdit={form.can_edit} contractedServices={contractedServices} onToggle={() => toggleSection("upResponsibles")} onChange={updateServiceLeader} />
                  <AccessSection open={openSections.access} values={values} canEdit={form.can_edit} onToggle={() => toggleSection("access")} onChange={updateField} />
                  <ValidationSection
                    open={openSections.validation}
                    progress={progress}
                    pendingSections={sectionProgress.filter((section) => section.done < section.total).length}
                    serviceAssignments={assignments}
                    accessPending={accessRows.filter(([rowKey]) => ["", "Pendente", "Bloqueado"].includes(getValue(values, `access.${rowKey}.status`))).length}
                    onToggle={() => toggleSection("validation")}
                    onFinalize={finalize}
                    canEdit={form.can_edit}
                    saving={saving}
                  />
                </div>
              ) : (
                <section className="rounded-2xl border border-slate-800 bg-[#06101f] p-6 text-slate-300">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-blue-300" />
                    <div>
                      <h2 className="text-lg font-black text-white">Kanban / Tarefas</h2>
                      <p className="text-sm text-slate-400">As tarefas continuam no board, mas o clique abre este formulario primeiro.</p>
                    </div>
                  </div>
                </section>
              )}
            </main>

            <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
              <section className="rounded-2xl border border-slate-800 bg-[#06101f] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Resumo do onboarding</h2>
                  <Sparkles className="h-4 w-4 text-blue-300" />
                </div>
                <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full" style={{ background: `conic-gradient(#1463ff ${progress * 3.6}deg, #12213a 0deg)` }}>
                  <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[#071327]">
                    <span className="text-3xl font-black text-white">{progress}%</span>
                    <span className="text-xs text-slate-400">concluido</span>
                  </div>
                </div>
                <p className="mt-4 text-center text-sm text-slate-300"><span className="font-bold text-blue-300">{completedFields}</span> de {totalFields} campos preenchidos</p>
                <div className="mt-5 border-t border-slate-800 pt-4">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Secoes</p>
                  <div className="space-y-3">
                    {sectionProgress.map((section) => (
                      <div key={section.id}>
                        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-300">
                          <span>{section.title}</span>
                          <span>{section.done}/{section.total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round((section.done / section.total) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">Proxima acao recomendada</p>
                <h3 className="mt-3 font-black text-white">{nextAction ? nextAction.title : "Finalizar onboarding"}</h3>
                <p className="mt-1 text-sm text-slate-300">
                  {nextAction ? "Complete os campos pendentes desta secao para destravar a validacao final." : "Todas as secoes principais estao preenchidas."}
                </p>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-[#06101f] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Atividade recente</p>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <ActivityLine icon={CheckCircle2} title={saveState === "saving" ? "Salvando alteracoes" : "Alteracoes salvas"} subtitle={updatedAt ? formatDate(updatedAt) : "Agora"} />
                  <ActivityLine icon={ClipboardCheck} title={form.status === "complete" ? "Onboarding finalizado" : "Onboarding iniciado"} subtitle={form.task.assignee?.name ?? "UP Flow"} />
                </div>
              </section>
            </aside>
          </div>

          <div className="sticky bottom-4 z-10 mt-5 rounded-2xl border border-slate-800 bg-[#06101f]/95 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </span>
                <span>{saveState === "saving" ? "Salvando automaticamente..." : "As alteracoes sao salvas automaticamente."}</span>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">{saveState === "saving" ? "Salvando" : "Tudo salvo"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void savePatch({ values: form.values })} disabled={!form.can_edit || saving} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-blue-400/60 disabled:opacity-50">
                  <Save className="h-4 w-4" /> Salvar resumo
                </button>
                <button type="button" onClick={finalize} disabled={!form.can_edit || saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2 text-sm font-black text-white shadow-[0_14px_34px_rgba(37,99,235,0.35)] disabled:opacity-50">
                  <Check className="h-4 w-4" /> Finalizar onboarding B2B
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value, avatar }: { label: string; value: string; avatar?: string }) {
  return (
    <div className="min-w-0 border-slate-800 sm:border-r sm:last:border-r-0">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {avatar && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{avatar}</span>}
        <p className="truncate text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-black", active ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white")}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function SectionShell({ index, title, accent, open, onToggle, children, done, total }: { index: number; title: string; accent: keyof typeof accentClasses; open: boolean; onToggle: () => void; children: ReactNode; done: number; total: number }) {
  return (
    <section className={cn("rounded-2xl border bg-[#06101f] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.25)]", accentClasses[accent])}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 border-b border-slate-800/80 pb-3 text-left">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black", accentClasses[accent])}>{index}</span>
          <h2 className="truncate text-sm font-black uppercase tracking-[0.04em] text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-slate-300">{done}/{total}</span>
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}

function FormSection({ index, section, values, open, canEdit, onToggle, onChange }: { index: number; section: SectionConfig; values: FormValues; open: boolean; canEdit: boolean; onToggle: () => void; onChange: (field: string, value: string) => void }) {
  const done = section.fields.filter((field) => isFilled(values, field.key)).length;
  return (
    <SectionShell index={index} title={section.title} accent={section.accent} open={open} onToggle={onToggle} done={done} total={section.fields.length}>
      <div className="grid gap-3 sm:grid-cols-2">
        {section.fields.map((field) => (
          <FieldControl key={field.key} field={field} value={getValue(values, field.key)} disabled={!canEdit} onChange={(value) => onChange(field.key, value)} />
        ))}
      </div>
      <button type="button" onClick={onToggle} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/50 text-sm font-black text-slate-200 hover:border-blue-400/60">
        Editar secao <ChevronDown className="h-4 w-4 -rotate-90" />
      </button>
    </SectionShell>
  );
}

function FieldControl({ field, value, disabled, onChange }: { field: FieldConfig; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const Icon = field.icon;
  const inputClass = "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:opacity-60";
  return (
    <label className={cn("min-w-0", field.span === "full" && "sm:col-span-2")}>
      <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Icon className="h-3.5 w-3.5 text-blue-300" /> {field.label}
      </span>
      {field.type === "textarea" ? (
        <textarea value={value} disabled={disabled} placeholder={field.placeholder ?? "-"} onChange={(event) => onChange(event.target.value)} rows={3} className={inputClass} />
      ) : field.type === "select" ? (
        <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          <option value="">Selecionar</option>
          {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input value={value} disabled={disabled} type={field.type ?? "text"} placeholder={field.placeholder ?? "-"} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      )}
    </label>
  );
}

function ResponsibleBrandSection({ open, values, canEdit, onToggle, onChange }: { open: boolean; values: FormValues; canEdit: boolean; onToggle: () => void; onChange: (field: string, value: string) => void }) {
  const done = brandResponsibleRows.filter(([rowKey]) => responsibleColumns.some(([columnKey]) => isFilled(values, `brandResponsible.${rowKey}.${columnKey}`))).length;
  return (
    <div className="lg:col-span-2">
      <SectionShell index={4} title="Responsaveis da marca" accent="pink" open={open} onToggle={onToggle} done={done} total={brandResponsibleRows.length}>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <div className="grid min-w-[880px] grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] border-b border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <span>Area</span>
            {responsibleColumns.map(([, label]) => <span key={label}>{label}</span>)}
          </div>
          {brandResponsibleRows.map(([rowKey, label]) => (
            <div key={rowKey} className="grid min-w-[880px] grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-slate-800 px-3 py-2 last:border-b-0">
              <span className="self-center text-sm font-bold text-white">{label}</span>
              {responsibleColumns.map(([columnKey]) => (
                <input key={columnKey} value={getValue(values, `brandResponsible.${rowKey}.${columnKey}`)} disabled={!canEdit} onChange={(event) => onChange(`brandResponsible.${rowKey}.${columnKey}`, event.target.value)} className="h-9 min-w-0 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-xs font-semibold text-white outline-none focus:border-blue-500 disabled:opacity-60" />
              ))}
            </div>
          ))}
        </div>
      </SectionShell>
    </div>
  );
}

function UpResponsibleSection({ open, assignments, teamUsers, canEdit, contractedServices, onToggle, onChange }: { open: boolean; assignments: ServiceAssignment[]; teamUsers: TeamUser[]; canEdit: boolean; contractedServices: string[]; onToggle: () => void; onChange: (assignment: ServiceAssignment, leaderId: string) => void }) {
  const rows: ServiceAssignment[] = assignments.length
    ? assignments
    : contractedServices.map((service) => ({ id: service, service, leader_id: null, department_id: null, department_name: "Marketing B2B", status: "needs_mapping", notes: null, leader: null, department: null }));
  const done = rows.filter((row) => Boolean(row.leader_id)).length;
  return (
    <div className="lg:col-span-2">
      <SectionShell index={5} title="Responsaveis UP por servico" accent="cyan" open={open} onToggle={onToggle} done={done} total={Math.max(rows.length, 1)}>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <div className="grid min-w-[760px] grid-cols-[1fr_1fr_1.2fr_0.8fr] border-b border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <span>Servico</span>
            <span>Departamento UP</span>
            <span>Responsavel UP</span>
            <span>Status</span>
          </div>
          {rows.map((assignment) => (
            <div key={assignment.id} className="grid min-w-[760px] grid-cols-[1fr_1fr_1.2fr_0.8fr] gap-2 border-b border-slate-800 px-3 py-2 last:border-b-0">
              <span className="self-center text-sm font-bold text-white">{assignment.service}</span>
              <span className="self-center text-sm text-slate-300">{assignment.department?.name ?? assignment.department_name ?? "Marketing B2B"}</span>
              <select value={assignment.leader_id ?? ""} disabled={!canEdit || !assignment.id} onChange={(event) => onChange(assignment, event.target.value)} className="h-9 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-sm font-semibold text-white outline-none focus:border-blue-500 disabled:opacity-60">
                <option value="">Selecionar responsavel</option>
                {teamUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <span className={cn("self-center rounded-full px-2.5 py-1 text-xs font-black", statusTone(assignment.status))}>
                {assignment.leader_id ? "Assigned" : "Precisa de mapeamento"}
              </span>
            </div>
          ))}
        </div>
      </SectionShell>
    </div>
  );
}

function AccessSection({ open, values, canEdit, onToggle, onChange }: { open: boolean; values: FormValues; canEdit: boolean; onToggle: () => void; onChange: (field: string, value: string) => void }) {
  const done = accessRows.filter(([rowKey]) => isFilled(values, `access.${rowKey}.status`)).length;
  return (
    <div className="lg:col-span-2">
      <SectionShell index={6} title="Acessos" accent="teal" open={open} onToggle={onToggle} done={done} total={accessRows.length}>
        <div className="grid gap-3 md:grid-cols-2">
          {accessRows.map(([rowKey, label]) => (
            <div key={rowKey} className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
              <p className="mb-2 text-sm font-black text-white">{label}</p>
              <div className="grid gap-2 sm:grid-cols-[0.9fr_1.1fr]">
                <select value={getValue(values, `access.${rowKey}.status`)} disabled={!canEdit} onChange={(event) => onChange(`access.${rowKey}.status`, event.target.value)} className="h-9 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-xs font-bold text-white outline-none focus:border-blue-500 disabled:opacity-60">
                  <option value="">Status</option>
                  {accessStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <input value={getValue(values, `access.${rowKey}.notes`)} disabled={!canEdit} onChange={(event) => onChange(`access.${rowKey}.notes`, event.target.value)} placeholder="Link, usuario ou observacao" className="h-9 rounded-lg border border-slate-800 bg-slate-950/70 px-2 text-xs font-semibold text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:opacity-60" />
              </div>
            </div>
          ))}
        </div>
      </SectionShell>
    </div>
  );
}

function ValidationSection({ open, progress, pendingSections, serviceAssignments, accessPending, onToggle, onFinalize, canEdit, saving }: { open: boolean; progress: number; pendingSections: number; serviceAssignments: ServiceAssignment[]; accessPending: number; onToggle: () => void; onFinalize: () => void; canEdit: boolean; saving: boolean }) {
  const missingServiceOwners = serviceAssignments.filter((assignment) => !assignment.leader_id).length;
  return (
    <SectionShell index={7} title="Validacao final" accent="green" open={open} onToggle={onToggle} done={progress >= 100 ? 1 : 0} total={1}>
      <div className="grid gap-3 sm:grid-cols-2">
        <ValidationItem label="Campos preenchidos" value={`${progress}%`} ok={progress >= 80} />
        <ValidationItem label="Secoes pendentes" value={String(pendingSections)} ok={pendingSections === 0} />
        <ValidationItem label="Responsaveis UP faltando" value={String(missingServiceOwners)} ok={missingServiceOwners === 0} />
        <ValidationItem label="Acessos pendentes" value={String(accessPending)} ok={accessPending === 0} />
      </div>
      <button type="button" onClick={onFinalize} disabled={!canEdit || saving} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-sm font-black text-white shadow-[0_14px_34px_rgba(37,99,235,0.35)] disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Finalizar onboarding B2B
      </button>
    </SectionShell>
  );
}

function ValidationItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-300">{label}</span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-black", ok ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300")}>{value}</span>
      </div>
    </div>
  );
}

function ActivityLine({ icon: Icon, title, subtitle }: { icon: ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="font-bold text-white">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
