"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  FileText,
  Globe2,
  Instagram,
  Loader2,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

type JsonFormValue =
  | string
  | number
  | boolean
  | null
  | JsonFormValue[]
  | { [key: string]: JsonFormValue };

type FormValues = Record<string, JsonFormValue>;
type TeamUser = { id: string; name: string; email: string; avatar_url?: string | null };

type ClientAddress = {
  id?: string;
  type: string;
  locationName: string;
  fullAddress: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
  mapsUrl: string;
  localContactName: string;
  localContactPhone: string;
  departmentUsage: string[];
  isPrimary: boolean;
  notes: string;
};

type Competitor = {
  id: string;
  name: string;
  instagram: string;
  website: string;
};

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
  completed_by?: string | null;
  completer?: { id: string; name: string; email: string } | null;
  can_edit: boolean;
  task: {
    id: string;
    title: string;
    status: string;
    assignee: { id: string; name: string; email: string } | null;
    project: { id: string; name: string } | null;
  };
  company: {
    id: string;
    name: string;
    website: string | null;
    industry: string | null;
    addresses?: ClientAddress[];
  };
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

type Accent = "blue" | "amber" | "purple" | "pink" | "cyan" | "teal" | "green";

type SectionSummary = {
  id: string;
  title: string;
  accent: Accent;
  done: number;
  total: number;
};

const OPTIONAL_HELPER = "Opcional — use este campo para adicionar contexto extra.";

const b2bFormLabels = {
  brandSection: "Sobre a Marca",
  brandName: "Nome da marca",
  brandOwner: "Proprietário / dono",
  cnpj: "CNPJ",
  website: "Site oficial",
  instagram: "Instagram",
  competitors: "Concorrentes",
  generalNotes: "Observações gerais",
  addresses: "Endereços do cliente",
  commercialRulesSection: "Regras Comerciais",
  acceptedDocumentRule: "Regra de cadastro / documento aceito",
  minimumOrder: "Pedido mínimo",
  paymentMethods: "Formas de pagamento",
  discountPolicy: "Política de desconto",
  commercialRestrictions: "Restrições comerciais",
  sizeRange: "Grade de tamanhos",
  ownManufacturing: "Fabricação própria?",
  nationalShipping: "Envio nacional?",
  commercialNotes: "Observações comerciais",
  targetSection: "Público-Alvo e Posicionamento",
  positioning: "Posicionamento da marca",
  brandStyle: "Estilo da marca",
  mainAudience: "Público-alvo principal",
  researchLink: "Link de pesquisa / benchmarking",
  behaviorNotes: "Observações de comportamento de compra",
  brandResponsiblesSection: "Responsáveis da Marca",
  brandResponsiblesNotes: "Observações sobre contatos e responsáveis",
  upResponsiblesSection: "Responsáveis UP por serviço",
  accessSection: "Acessos",
  accessNotes: "Observações de acesso",
  validationSection: "Validação final",
  finalNotes: "Observações finais",
  editSection: "Editar seção",
  saveSection: "Salvar",
  editMode: "Modo de edição",
  editModeHelp: "Você está editando esta seção.",
  sectionSaved: "Seção salva",
};

const documentRuleOptions = [
  {
    value: "clothing_cnae",
    label: "CNAE de vestuário",
    description: "Apenas empresas com CNAE relacionado a vestuário podem comprar.",
  },
  {
    value: "all_cnpjs",
    label: "Todos CNPJs",
    description: "Qualquer empresa com CNPJ pode comprar.",
  },
  {
    value: "cnpj_or_cpf",
    label: "Aceita CNPJ e CPF",
    description: "A marca aceita compras tanto de empresas quanto de pessoas físicas.",
  },
];

const booleanishOptions = ["Sim", "Não", "Parcial"];
const shippingOptions = ["Sim", "Não", "Algumas regiões"];
const accessStatusOptions = ["Concedido", "Pendente", "Parcial", "Bloqueado", "Não se aplica"];

const addressTypes = [
  "Loja",
  "Fábrica",
  "Showroom",
  "Escritório",
  "Centro de distribuição",
  "Estúdio",
  "Outro",
];

const departmentUsageOptions = [
  "Marketing B2B",
  "Marketing B2C",
  "Creative & Design",
  "Production",
  "Performance",
  "Technical Support",
  "Comercial",
  "Finance",
];

const brandResponsibleRows = [
  ["finance", "Financeiro"],
  ["marketing", "Marketing"],
  ["commercial", "Comercial"],
  ["creativeApproval", "Aprovação de criativos"],
  ["operations", "Operações"],
  ["other", "Outros"],
] as const;

const responsibleColumns = [
  ["name", "Nome"],
  ["role", "Cargo"],
  ["phone", "WhatsApp / Telefone"],
  ["email", "E-mail"],
  ["note", "Link / Observação"],
] as const;

const accessRows = [
  ["vestiUpZero", "Vesti / UP Zero"],
  ["dashboard", "Acesso ao dashboard"],
  ["dashboardLink", "Link do dashboard"],
  ["metaAds", "Meta Ads"],
  ["googleAds", "Google Ads"],
  ["ga4Gtm", "GA4 / GTM"],
  ["ecommercePlatform", "Plataforma de e-commerce"],
  ["domainDns", "Domínio / DNS"],
  ["driveFolder", "Drive / materiais"],
  ["otherAccess", "Outros acessos"],
] as const;

const accentClasses: Record<Accent, { ring: string; badge: string; line: string; soft: string }> = {
  blue: {
    ring: "border-blue-500/40",
    badge: "border-blue-400/40 bg-blue-500/10 text-blue-500 dark:text-blue-300",
    line: "bg-blue-500",
    soft: "bg-blue-500/10",
  },
  amber: {
    ring: "border-amber-400/45",
    badge: "border-amber-400/45 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    line: "bg-amber-500",
    soft: "bg-amber-500/10",
  },
  purple: {
    ring: "border-purple-400/45",
    badge: "border-purple-400/45 bg-purple-500/10 text-purple-600 dark:text-purple-300",
    line: "bg-purple-500",
    soft: "bg-purple-500/10",
  },
  pink: {
    ring: "border-pink-400/45",
    badge: "border-pink-400/45 bg-pink-500/10 text-pink-600 dark:text-pink-300",
    line: "bg-pink-500",
    soft: "bg-pink-500/10",
  },
  cyan: {
    ring: "border-cyan-400/45",
    badge: "border-cyan-400/45 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
    line: "bg-cyan-500",
    soft: "bg-cyan-500/10",
  },
  teal: {
    ring: "border-teal-400/45",
    badge: "border-teal-400/45 bg-teal-500/10 text-teal-600 dark:text-teal-300",
    line: "bg-teal-500",
    soft: "bg-teal-500/10",
  },
  green: {
    ring: "border-emerald-400/45",
    badge: "border-emerald-400/45 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    line: "bg-emerald-500",
    soft: "bg-emerald-500/10",
  },
};

function textValue(values: FormValues, key: string) {
  const raw = values[key];
  if (typeof raw === "string") return raw;
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

function isTextFilled(values: FormValues, key: string) {
  return textValue(values, key).trim().length > 0;
}

function createLocalId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function normalizeDocumentRule(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["clothing_cnae", "cnae de vestuário", "cnae de vestuario", "sim"].includes(normalized)) return "clothing_cnae";
  if (["all_cnpjs", "todos cnpjs", "não", "nao"].includes(normalized)) return "all_cnpjs";
  if (["cnpj_or_cpf", "aceita cnpj e cpf", "depende"].includes(normalized)) return "cnpj_or_cpf";
  return value;
}

function combineLegacy(primary: string, legacy: string) {
  if (!legacy.trim()) return primary;
  if (!primary.trim()) return legacy;
  if (primary.includes(legacy)) return primary;
  return `${primary}\n\n${legacy}`;
}

function normalizeInitialValues(data: B2BFormResponse) {
  const values: FormValues = { ...(data.values ?? {}) };
  if (!isTextFilled(values, "brand.name")) values["brand.name"] = data.company.name ?? "";
  if (!isTextFilled(values, "brand.website") && data.company.website) values["brand.website"] = data.company.website;

  if (!isTextFilled(values, "commercial.acceptedDocumentRule")) {
    values["commercial.acceptedDocumentRule"] = normalizeDocumentRule(textValue(values, "commercial.cnpjRequired"));
  }

  if (!isTextFilled(values, "targetPositioning.positioning")) {
    values["targetPositioning.positioning"] = combineLegacy(
      textValue(values, "positioning.brandPositioning"),
      textValue(values, "positioning.valueProposition"),
    );
  }
  if (!isTextFilled(values, "targetPositioning.brandStyle")) {
    values["targetPositioning.brandStyle"] = textValue(values, "positioning.brandStyle");
  }
  if (!isTextFilled(values, "targetPositioning.mainAudience")) {
    values["targetPositioning.mainAudience"] = combineLegacy(
      textValue(values, "positioning.targetAudience"),
      textValue(values, "positioning.resellerProfile"),
    );
  }
  if (!isTextFilled(values, "targetPositioning.researchLink")) {
    values["targetPositioning.researchLink"] = textValue(values, "positioning.benchmarkLink");
  }
  if (!isTextFilled(values, "targetPositioning.behaviorNotes")) {
    values["targetPositioning.behaviorNotes"] = textValue(values, "positioning.buyingBehaviorNotes");
  }

  return values;
}

function normalizeAddress(raw: Partial<ClientAddress> | undefined, isPrimary = false): ClientAddress {
  return {
    id: raw?.id,
    type: raw?.type ?? "",
    locationName: raw?.locationName ?? "",
    fullAddress: raw?.fullAddress ?? "",
    zipCode: raw?.zipCode ?? "",
    city: raw?.city ?? "",
    state: raw?.state ?? "",
    country: raw?.country ?? "Brasil",
    mapsUrl: raw?.mapsUrl ?? "",
    localContactName: raw?.localContactName ?? "",
    localContactPhone: raw?.localContactPhone ?? "",
    departmentUsage: Array.isArray(raw?.departmentUsage) ? raw.departmentUsage.filter(Boolean) : [],
    isPrimary: Boolean(raw?.isPrimary ?? isPrimary),
    notes: raw?.notes ?? "",
  };
}

function emptyAddress(isPrimary = false): ClientAddress {
  return normalizeAddress({ id: createLocalId("address") }, isPrimary);
}

function normalizeAddresses(data: B2BFormResponse, values: FormValues) {
  const saved = data.company.addresses?.map((address, index) => normalizeAddress(address, index === 0)) ?? [];
  if (saved.length > 0) {
    const hasPrimary = saved.some((address) => address.isPrimary);
    return saved.map((address, index) => ({ ...address, isPrimary: hasPrimary ? address.isPrimary : index === 0 }));
  }

  const legacyAddress = textValue(values, "brand.address");
  if (legacyAddress.trim()) {
    return [
      normalizeAddress(
        {
          type: "Outro",
          locationName: "Endereço principal",
          fullAddress: legacyAddress,
          country: "Brasil",
          departmentUsage: ["Marketing B2B"],
        },
        true,
      ),
    ];
  }
  return [emptyAddress(true)];
}

function isAddressComplete(addresses: ClientAddress[]) {
  return addresses.some((address) => address.fullAddress.trim().length > 0);
}

function normalizeCompetitors(values: FormValues): Competitor[] {
  const raw = values["brand.competitors"];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const record = item as Record<string, JsonFormValue>;
        return {
          id: typeof record.id === "string" ? record.id : createLocalId("competitor"),
          name: typeof record.name === "string" ? record.name : "",
          instagram: typeof record.instagram === "string" ? record.instagram : "",
          website: typeof record.website === "string" ? record.website : "",
        };
      })
      .filter((item): item is Competitor => Boolean(item));
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ id: createLocalId("competitor"), name, instagram: "", website: "" }));
  }
  return [];
}

function cleanCompetitors(competitors: Competitor[]): JsonFormValue[] {
  return competitors
    .map((competitor) => ({
      id: competitor.id,
      name: competitor.name.trim(),
      instagram: competitor.instagram.trim(),
      website: competitor.website.trim(),
    }))
    .filter((competitor) => competitor.name.length > 0);
}

function cleanAddresses(addresses: ClientAddress[]) {
  return addresses.map((address) => ({
    ...address,
    departmentUsage: address.departmentUsage.filter(Boolean),
  }));
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("concedido") || normalized.includes("complete") || normalized.includes("assigned")) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  }
  if (normalized.includes("bloqueado") || normalized.includes("needs")) {
    return "border-red-400/30 bg-red-500/10 text-red-600 dark:text-red-300";
  }
  if (normalized.includes("parcial")) return "border-cyan-400/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300";
  return "border-amber-400/30 bg-amber-500/10 text-amber-600 dark:text-amber-300";
}

function documentRuleLabel(value: string) {
  return documentRuleOptions.find((option) => option.value === value)?.label ?? value;
}

function calculateSectionProgress(values: FormValues, addresses: ClientAddress[], assignments: ServiceAssignment[]): SectionSummary[] {
  const assignmentTotal = assignments.length;
  const sections: SectionSummary[] = [
    {
      id: "brand",
      title: b2bFormLabels.brandSection,
      accent: "blue",
      total: 6,
      done:
        Number(isTextFilled(values, "brand.name")) +
        Number(isTextFilled(values, "brand.owner")) +
        Number(isTextFilled(values, "brand.cnpj")) +
        Number(isAddressComplete(addresses)) +
        Number(isTextFilled(values, "brand.website")) +
        Number(isTextFilled(values, "brand.instagram")),
    },
    {
      id: "commercial",
      title: b2bFormLabels.commercialRulesSection,
      accent: "amber",
      total: 8,
      done:
        Number(isTextFilled(values, "commercial.acceptedDocumentRule")) +
        Number(isTextFilled(values, "commercial.minimumOrder")) +
        Number(isTextFilled(values, "commercial.paymentMethods")) +
        Number(isTextFilled(values, "commercial.discountPolicy")) +
        Number(isTextFilled(values, "commercial.restrictions")) +
        Number(isTextFilled(values, "commercial.sizeGrid")) +
        Number(isTextFilled(values, "commercial.ownManufacturing")) +
        Number(isTextFilled(values, "commercial.nationalShipping")),
    },
    {
      id: "target",
      title: b2bFormLabels.targetSection,
      accent: "purple",
      total: 3,
      done:
        Number(isTextFilled(values, "targetPositioning.positioning")) +
        Number(isTextFilled(values, "targetPositioning.brandStyle")) +
        Number(isTextFilled(values, "targetPositioning.mainAudience")),
    },
    {
      id: "brandResponsibles",
      title: b2bFormLabels.brandResponsiblesSection,
      accent: "pink",
      total: brandResponsibleRows.length,
      done: brandResponsibleRows.filter(([rowKey]) => isTextFilled(values, `brandResponsible.${rowKey}.name`)).length,
    },
    {
      id: "upResponsibles",
      title: b2bFormLabels.upResponsiblesSection,
      accent: "cyan",
      total: assignmentTotal,
      done: assignments.filter((assignment) => Boolean(assignment.leader_id)).length,
    },
    {
      id: "access",
      title: b2bFormLabels.accessSection,
      accent: "teal",
      total: accessRows.length,
      done: accessRows.filter(([rowKey]) => isTextFilled(values, `access.${rowKey}.status`)).length,
    },
  ];
  return sections.filter((section) => section.total > 0);
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
  const [form, setForm] = useState<B2BFormResponse | null>(null);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [addresses, setAddresses] = useState<ClientAddress[]>([emptyAddress(true)]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activeTab, setActiveTab] = useState<"form" | "kanban">("form");
  const [activeSection, setActiveSection] = useState("brand");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    brand: true,
    commercial: true,
    target: true,
    brandResponsibles: true,
    upResponsibles: true,
    access: true,
    validation: true,
  });
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valuesRef = useRef<FormValues>({});
  const addressesRef = useRef<ClientAddress[]>([emptyAddress(true)]);
  const competitorsRef = useRef<Competitor[]>([]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const loadForm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/onboarding/marketing-b2b-form/${taskId}`);
      if (!res.ok) throw new Error("Não foi possível carregar o onboarding B2B");
      const data = (await res.json()) as B2BFormResponse;
      const normalizedValues = normalizeInitialValues(data);
      const normalizedAddresses = normalizeAddresses(data, normalizedValues);
      const normalizedCompetitors = normalizeCompetitors(normalizedValues);

      normalizedValues["brand.competitors"] = cleanCompetitors(normalizedCompetitors);
      valuesRef.current = normalizedValues;
      addressesRef.current = normalizedAddresses;
      competitorsRef.current = normalizedCompetitors;
      setForm({ ...data, values: normalizedValues });
      setAddresses(normalizedAddresses);
      setCompetitors(normalizedCompetitors);

      if (data.onboarding.workspace_id) {
        const usersRes = await fetch(`/api/users?workspace_id=${data.onboarding.workspace_id}&status=active&limit=500`);
        if (usersRes.ok) {
          const usersData = (await usersRes.json()) as { items?: TeamUser[] };
          setTeamUsers(usersData.items ?? []);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar o onboarding B2B");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadForm();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [loadForm]);

  const currentValues = form?.values ?? valuesRef.current;
  const assignments = useMemo(
    () => form?.onboarding.service_assignments ?? [],
    [form?.onboarding.service_assignments],
  );
  const contractedServices = parseServices(form?.onboarding.contracted_services);
  const sectionProgress = useMemo(
    () => calculateSectionProgress(currentValues, addresses, assignments),
    [addresses, assignments, currentValues],
  );
  const totalRequired = sectionProgress.reduce((sum, section) => sum + section.total, 0);
  const completedRequired = sectionProgress.reduce((sum, section) => sum + section.done, 0);
  const progress = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;
  const nextAction = sectionProgress.find((section) => section.done < section.total);
  const updatedAt = form?.updated_at ?? form?.completed_at ?? null;
  const canEdit = Boolean(form?.can_edit);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id.replace("b2b-section-", ""));
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: [0.15, 0.35, 0.6] },
    );

    Object.values(sectionRefs.current).forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [openSections, activeTab]);

  const buildSaveValues = useCallback(() => {
    return {
      ...valuesRef.current,
      "brand.competitors": cleanCompetitors(competitorsRef.current),
    } satisfies FormValues;
  }, []);

  const savePatch = useCallback(
    async (payload: { finalize?: boolean } = {}) => {
      if (!canEdit) return;
      setSaving(true);
      setSaveState("saving");
      try {
        const res = await fetch(`/api/onboarding/marketing-b2b-form/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values: buildSaveValues(),
            addresses: cleanAddresses(addressesRef.current),
            finalize: payload.finalize,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Não foi possível salvar o formulário B2B");
        }
        const data = (await res.json()) as B2BFormResponse;
        setForm({ ...data, values: valuesRef.current });
        setSaveState("saved");
        if (payload.finalize) onUpdate?.();
      } catch (err) {
        setSaveState("error");
        toast.error(err instanceof Error ? err.message : "Não foi possível salvar o formulário B2B");
      } finally {
        setSaving(false);
      }
    },
    [buildSaveValues, canEdit, onUpdate, taskId],
  );

  const scheduleSave = useCallback(() => {
    if (!canEdit) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void savePatch(), 700);
  }, [canEdit, savePatch]);

  const updateField = (field: string, value: string) => {
    const nextValues = { ...valuesRef.current, [field]: value };
    valuesRef.current = nextValues;
    setForm((current) => (current ? { ...current, values: nextValues } : current));
    scheduleSave();
  };

  const updateAddresses = (nextAddresses: ClientAddress[]) => {
    const normalized = nextAddresses.length ? nextAddresses : [emptyAddress(true)];
    const hasPrimary = normalized.some((address) => address.isPrimary);
    const withPrimary = normalized.map((address, index) => ({ ...address, isPrimary: hasPrimary ? address.isPrimary : index === 0 }));
    addressesRef.current = withPrimary;
    setAddresses(withPrimary);
    scheduleSave();
  };

  const updateCompetitors = (nextCompetitors: Competitor[]) => {
    competitorsRef.current = nextCompetitors;
    setCompetitors(nextCompetitors);
    valuesRef.current = { ...valuesRef.current, "brand.competitors": cleanCompetitors(nextCompetitors) };
    setForm((current) => (current ? { ...current, values: valuesRef.current } : current));
    scheduleSave();
  };

  const handleSectionAction = async (sectionId: string) => {
    if (!editingSections[sectionId]) {
      setEditingSections((current) => ({ ...current, [sectionId]: true }));
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await savePatch();
    setEditingSections((current) => ({ ...current, [sectionId]: false }));
    toast.success(b2bFormLabels.sectionSaved);
  };

  const toggleSection = (id: string) => setOpenSections((current) => ({ ...current, [id]: !current[id] }));

  const finalize = async () => {
    if (completedRequired < totalRequired) {
      toast.error("Complete os campos obrigatórios antes de finalizar o onboarding B2B");
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await savePatch({ finalize: true });
    toast.success("Onboarding B2B finalizado");
  };

  const updateServiceLeader = async (assignment: ServiceAssignment, leaderId: string) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`/api/onboarding/${form?.onboarding.id}`, {
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
        throw new Error(data.error || "Não foi possível salvar o responsável do serviço");
      }
      toast.success("Responsável do serviço salvo");
      await loadForm();
      onUpdate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o responsável do serviço");
    }
  };

  const scrollToSection = (id: string) => {
    setOpenSections((current) => ({ ...current, [id]: true }));
    window.requestAnimationFrame(() => {
      sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  if (loading) {
    return (
      <div
        className={cn(
          "flex min-h-[420px] items-center justify-center bg-background text-foreground dark:bg-[#020817] dark:text-slate-200",
          !embedded && "fixed inset-0 z-50",
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!form) return null;

  const assigneeName = form.task.assignee?.name ?? "Sem responsável";

  return (
    <div className={cn(!embedded && "fixed inset-0 z-50 overflow-y-auto bg-background dark:bg-[#020817]", embedded && "w-full")}>
      <div className="min-h-screen bg-background px-4 py-5 text-foreground dark:bg-[#020817] dark:text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1560px]">
          <TopSearch onClose={onClose} />

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <main className="min-w-0 space-y-5">
              <HeaderCard
                companyName={form.company.name}
                assigneeName={assigneeName}
                progress={progress}
                updatedAt={updatedAt}
                status={form.status}
                onClose={onClose}
              />

              <div className="border-b border-border dark:border-slate-800">
                <TabButton active={activeTab === "form"} onClick={() => setActiveTab("form")} icon={ClipboardCheck} label="Formulário de Onboarding" />
                <TabButton active={activeTab === "kanban"} onClick={() => setActiveTab("kanban")} icon={BarChart3} label="Kanban / tarefas" />
              </div>

              {activeTab === "form" ? (
                <div className="space-y-5">
                  <BrandSection
                    sectionRef={(node) => {
                      sectionRefs.current.brand = node;
                    }}
                    values={valuesRef.current}
                    addresses={addresses}
                    competitors={competitors}
                    canEdit={canEdit}
                    open={openSections.brand}
                    editing={Boolean(editingSections.brand)}
                    onToggle={() => toggleSection("brand")}
                    onAction={() => void handleSectionAction("brand")}
                    onFieldChange={updateField}
                    onAddressesChange={updateAddresses}
                    onCompetitorsChange={updateCompetitors}
                  />

                  <CommercialSection
                    sectionRef={(node) => {
                      sectionRefs.current.commercial = node;
                    }}
                    values={valuesRef.current}
                    canEdit={canEdit}
                    open={openSections.commercial}
                    editing={Boolean(editingSections.commercial)}
                    onToggle={() => toggleSection("commercial")}
                    onAction={() => void handleSectionAction("commercial")}
                    onFieldChange={updateField}
                  />

                  <TargetSection
                    sectionRef={(node) => {
                      sectionRefs.current.target = node;
                    }}
                    values={valuesRef.current}
                    canEdit={canEdit}
                    open={openSections.target}
                    editing={Boolean(editingSections.target)}
                    onToggle={() => toggleSection("target")}
                    onAction={() => void handleSectionAction("target")}
                    onFieldChange={updateField}
                  />

                  <ResponsibleBrandSection
                    sectionRef={(node) => {
                      sectionRefs.current.brandResponsibles = node;
                    }}
                    values={valuesRef.current}
                    canEdit={canEdit}
                    open={openSections.brandResponsibles}
                    editing={Boolean(editingSections.brandResponsibles)}
                    onToggle={() => toggleSection("brandResponsibles")}
                    onAction={() => void handleSectionAction("brandResponsibles")}
                    onFieldChange={updateField}
                  />

                  <UpResponsibleSection
                    sectionRef={(node) => {
                      sectionRefs.current.upResponsibles = node;
                    }}
                    assignments={assignments}
                    teamUsers={teamUsers}
                    contractedServices={contractedServices}
                    values={valuesRef.current}
                    canEdit={canEdit}
                    open={openSections.upResponsibles}
                    editing={Boolean(editingSections.upResponsibles)}
                    onToggle={() => toggleSection("upResponsibles")}
                    onAction={() => void handleSectionAction("upResponsibles")}
                    onServiceLeaderChange={updateServiceLeader}
                    onFieldChange={updateField}
                  />

                  <AccessSection
                    sectionRef={(node) => {
                      sectionRefs.current.access = node;
                    }}
                    values={valuesRef.current}
                    canEdit={canEdit}
                    open={openSections.access}
                    editing={Boolean(editingSections.access)}
                    onToggle={() => toggleSection("access")}
                    onAction={() => void handleSectionAction("access")}
                    onFieldChange={updateField}
                  />

                  <ValidationSection
                    sectionRef={(node) => {
                      sectionRefs.current.validation = node;
                    }}
                    values={valuesRef.current}
                    progress={progress}
                    pendingSections={sectionProgress.filter((section) => section.done < section.total).length}
                    serviceAssignments={assignments}
                    accessPending={accessRows.length - (sectionProgress.find((section) => section.id === "access")?.done ?? 0)}
                    canEdit={canEdit}
                    saving={saving}
                    open={openSections.validation}
                    editing={Boolean(editingSections.validation)}
                    onToggle={() => toggleSection("validation")}
                    onAction={() => void handleSectionAction("validation")}
                    onFieldChange={updateField}
                    onFinalize={() => void finalize()}
                  />
                </div>
              ) : (
                <KanbanPlaceholder taskTitle={form.task.title} taskStatus={form.task.status} />
              )}
            </main>

            <ProgressSidebar
              progress={progress}
              completed={completedRequired}
              total={totalRequired}
              sections={sectionProgress}
              activeSection={activeSection}
              nextAction={nextAction}
              updatedAt={updatedAt}
              formStatus={form.status}
              saveState={saveState}
              onSectionClick={scrollToSection}
              onFinalize={() => void finalize()}
            />
          </div>

          <BottomSaveBar
            saveState={saveState}
            saving={saving}
            canEdit={canEdit}
            onSave={() => void savePatch()}
            onFinalize={() => void finalize()}
          />
        </div>
      </div>
    </div>
  );
}

function TopSearch({ onClose }: { onClose?: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground shadow-sm dark:border-slate-800 dark:bg-[#06101f] dark:shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-500 dark:text-blue-300">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground dark:text-slate-400">Buscar marketing b2b onboarding, projetos, tarefas, docs...</p>
      <span className="rounded-full border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground dark:border-slate-700 dark:text-slate-400">Ctrl K</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function HeaderCard({
  companyName,
  assigneeName,
  progress,
  updatedAt,
  status,
  onClose,
}: {
  companyName: string;
  assigneeName: string;
  progress: number;
  updatedAt: string | null;
  status: string;
  onClose?: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm dark:border-slate-800 dark:bg-[#06101f] dark:shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button onClick={onClose} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300" type="button">
            <ArrowLeft className="h-4 w-4" /> Voltar para Marketing B2B
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-foreground dark:text-white sm:text-3xl">Marketing B2B Onboarding</h1>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
              {status === "complete" ? "Concluído" : "Em andamento"}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground dark:text-slate-400">Formulário e execução do onboarding para novos clientes de Marketing B2B.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold text-foreground hover:border-blue-400/60 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
            <FileText className="h-4 w-4" /> Docs
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-4 dark:border-slate-800 sm:grid-cols-2 xl:grid-cols-4">
        <InfoBlock label="Cliente" value={companyName} />
        <InfoBlock label="Responsável" value={assigneeName} avatar={initials(assigneeName)} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground dark:text-slate-500">Progresso geral</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 min-w-0 flex-1 rounded-full bg-muted dark:bg-slate-800">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm font-black text-foreground dark:text-white">{progress}%</p>
          </div>
        </div>
        <InfoBlock label="Última atualização" value={updatedAt ? formatDate(updatedAt) : "—"} />
      </div>
    </section>
  );
}

function InfoBlock({ label, value, avatar }: { label: string; value: string; avatar?: string }) {
  return (
    <div className="min-w-0 border-border dark:border-slate-800 xl:border-r xl:last:border-r-0">
      <p className="text-xs font-semibold text-muted-foreground dark:text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {avatar && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{avatar}</span>}
        <p className="truncate text-sm font-bold text-foreground dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-black",
        active
          ? "border-blue-500 text-foreground dark:text-white"
          : "border-transparent text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function SectionShell({
  id,
  index,
  title,
  description,
  accent,
  open,
  editing,
  canEdit,
  done,
  total,
  sectionRef,
  onToggle,
  onAction,
  children,
}: {
  id: string;
  index: number;
  title: string;
  description?: string;
  accent: Accent;
  open: boolean;
  editing: boolean;
  canEdit: boolean;
  done: number;
  total: number;
  sectionRef?: (node: HTMLElement | null) => void;
  onToggle: () => void;
  onAction: () => void;
  children: ReactNode;
}) {
  const accentClass = accentClasses[accent];
  return (
    <section
      id={`b2b-section-${id}`}
      ref={sectionRef}
      className={cn(
        "w-full scroll-mt-28 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all dark:bg-[#06101f] dark:shadow-[0_18px_60px_rgba(0,0,0,0.25)]",
        accentClass.ring,
        editing && "border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.45),0_16px_50px_rgba(37,99,235,0.16)]",
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 border-b border-border px-4 py-4 text-left dark:border-slate-800/80">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black", accentClass.badge)}>{index}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-sm font-black uppercase tracking-[0.04em] text-foreground dark:text-white">{title}</h2>
              {editing && <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-300">{b2bFormLabels.editMode}</span>}
            </div>
            {description && <p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">{description}</p>}
            {editing && <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300">{b2bFormLabels.editModeHelp}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-black text-muted-foreground dark:text-slate-300">{done}/{total}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform dark:text-slate-400", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="p-4">
          {children}
          <button
            type="button"
            onClick={onAction}
            disabled={!canEdit}
            className={cn(
              "mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/70 text-sm font-black text-foreground transition hover:border-blue-400/60 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200",
              editing && "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-200",
            )}
          >
            {editing ? b2bFormLabels.saveSection : b2bFormLabels.editSection}
            {editing ? <Save className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 -rotate-90" />}
          </button>
        </div>
      )}
    </section>
  );
}

function TextInput({
  label,
  value,
  icon: Icon,
  disabled,
  required,
  optional,
  helper,
  placeholder,
  type = "text",
  span = "normal",
  onChange,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  disabled: boolean;
  required?: boolean;
  optional?: boolean;
  helper?: string;
  placeholder?: string;
  type?: string;
  span?: "normal" | "full";
  onChange: (value: string) => void;
}) {
  const pending = required && !value.trim();
  return (
    <label className={cn("min-w-0", span === "full" && "sm:col-span-2 xl:col-span-4")}>
      <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground dark:text-slate-400">
        <Icon className="h-3.5 w-3.5 text-blue-400 dark:text-blue-300" />
        <span>{label}</span>
        {optional && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground dark:bg-slate-800 dark:text-slate-500">Opcional</span>}
        {pending && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">Pendente</span>}
      </span>
      <input
        value={value}
        disabled={disabled}
        type={type}
        placeholder={placeholder ?? "—"}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-blue-500 disabled:bg-muted/50 disabled:opacity-80 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-600 dark:disabled:bg-slate-900/60"
      />
      {helper && <p className="mt-1 text-xs text-muted-foreground dark:text-slate-500">{helper}</p>}
    </label>
  );
}

function TextAreaInput({
  label,
  value,
  icon: Icon,
  disabled,
  optional,
  helper,
  placeholder,
  rows = 3,
  onChange,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  disabled: boolean;
  optional?: boolean;
  helper?: string;
  placeholder?: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="sm:col-span-2 xl:col-span-4">
      <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground dark:text-slate-400">
        <Icon className="h-3.5 w-3.5 text-blue-400 dark:text-blue-300" />
        <span>{label}</span>
        {optional && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground dark:bg-slate-800 dark:text-slate-500">Opcional</span>}
      </span>
      {helper && <p className="mt-1 text-xs text-muted-foreground dark:text-slate-500">{helper}</p>}
      <textarea
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? "—"}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-blue-500 disabled:bg-muted/50 disabled:opacity-80 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-600 dark:disabled:bg-slate-900/60"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  icon: Icon,
  disabled,
  required,
  helper,
  options,
  onChange,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  disabled: boolean;
  required?: boolean;
  helper?: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const pending = required && !value.trim();
  return (
    <label className="min-w-0">
      <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground dark:text-slate-400">
        <Icon className="h-3.5 w-3.5 text-blue-400 dark:text-blue-300" />
        <span>{label}</span>
        {pending && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">Pendente</span>}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-blue-500 disabled:bg-muted/50 disabled:opacity-80 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white dark:disabled:bg-slate-900/60"
      >
        <option value="">Selecionar</option>
        {options.map((option) => {
          const valueKey = typeof option === "string" ? option : option.value;
          const labelText = typeof option === "string" ? option : option.label;
          return (
            <option key={valueKey} value={valueKey}>
              {labelText}
            </option>
          );
        })}
      </select>
      {helper && <p className="mt-1 text-xs text-muted-foreground dark:text-slate-500">{helper}</p>}
    </label>
  );
}

function BrandSection({
  sectionRef,
  values,
  addresses,
  competitors,
  canEdit,
  open,
  editing,
  onToggle,
  onAction,
  onFieldChange,
  onAddressesChange,
  onCompetitorsChange,
}: {
  sectionRef?: (node: HTMLElement | null) => void;
  values: FormValues;
  addresses: ClientAddress[];
  competitors: Competitor[];
  canEdit: boolean;
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  onAction: () => void;
  onFieldChange: (field: string, value: string) => void;
  onAddressesChange: (addresses: ClientAddress[]) => void;
  onCompetitorsChange: (competitors: Competitor[]) => void;
}) {
  const done =
    Number(isTextFilled(values, "brand.name")) +
    Number(isTextFilled(values, "brand.owner")) +
    Number(isTextFilled(values, "brand.cnpj")) +
    Number(isAddressComplete(addresses)) +
    Number(isTextFilled(values, "brand.website")) +
    Number(isTextFilled(values, "brand.instagram"));

  return (
    <SectionShell
      id="brand"
      index={1}
      title={b2bFormLabels.brandSection}
      accent="blue"
      open={open}
      editing={editing}
      canEdit={canEdit}
      done={done}
      total={6}
      sectionRef={sectionRef}
      onToggle={onToggle}
      onAction={onAction}
    >
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        <TextInput label={b2bFormLabels.brandName} value={textValue(values, "brand.name")} icon={Building2} disabled={!canEdit || !editing} required placeholder="Ex.: Nome público da marca" onChange={(value) => onFieldChange("brand.name", value)} />
        <TextInput label={b2bFormLabels.brandOwner} value={textValue(values, "brand.owner")} icon={UserRound} disabled={!canEdit || !editing} required placeholder="Nome do proprietário" onChange={(value) => onFieldChange("brand.owner", value)} />
        <TextInput label={b2bFormLabels.cnpj} value={textValue(values, "brand.cnpj")} icon={ClipboardCheck} disabled={!canEdit || !editing} required placeholder="00.000.000/0000-00" onChange={(value) => onFieldChange("brand.cnpj", value)} />
        <TextInput label={b2bFormLabels.website} value={textValue(values, "brand.website")} icon={Globe2} disabled={!canEdit || !editing} required type="url" placeholder="https://exemplo.com" onChange={(value) => onFieldChange("brand.website", value)} />
        <TextInput label={b2bFormLabels.instagram} value={textValue(values, "brand.instagram")} icon={Instagram} disabled={!canEdit || !editing} required placeholder="@marca" onChange={(value) => onFieldChange("brand.instagram", value)} />
      </div>

      <AddressManager addresses={addresses} disabled={!canEdit || !editing} onChange={onAddressesChange} />
      <CompetitorManager competitors={competitors} disabled={!canEdit || !editing} onChange={onCompetitorsChange} />

      <div className="mt-4 grid gap-4">
        <TextAreaInput
          label={b2bFormLabels.generalNotes}
          value={textValue(values, "brand.notes")}
          icon={FileText}
          disabled={!canEdit || !editing}
          optional
          helper={OPTIONAL_HELPER}
          placeholder="Contexto extra sobre a marca, operação ou posicionamento."
          onChange={(value) => onFieldChange("brand.notes", value)}
        />
      </div>
    </SectionShell>
  );
}

function AddressManager({
  addresses,
  disabled,
  onChange,
}: {
  addresses: ClientAddress[];
  disabled: boolean;
  onChange: (addresses: ClientAddress[]) => void;
}) {
  const updateAddress = (index: number, patch: Partial<ClientAddress>) => {
    const next = addresses.map((address, currentIndex) => {
      if (currentIndex !== index) {
        return patch.isPrimary ? { ...address, isPrimary: false } : address;
      }
      return { ...address, ...patch };
    });
    onChange(next);
  };

  const duplicateAddress = (index: number) => {
    const source = addresses[index];
    if (!source) return;
    onChange([
      ...addresses.slice(0, index + 1),
      { ...source, id: createLocalId("address"), locationName: `${source.locationName || "Endereço"} cópia`, isPrimary: false },
      ...addresses.slice(index + 1),
    ]);
  };

  const removeAddress = (index: number) => {
    const next = addresses.filter((_, currentIndex) => currentIndex !== index);
    onChange(next.length ? next : [emptyAddress(true)]);
  };

  return (
    <div className="mt-5 rounded-lg border border-border bg-background/60 p-4 dark:border-slate-800 dark:bg-slate-950/35">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500 dark:text-blue-300" />
            <h3 className="text-sm font-black text-foreground dark:text-white">{b2bFormLabels.addresses}</h3>
            {!isAddressComplete(addresses) && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">Pendente</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground dark:text-slate-500">Cadastre loja, fábrica, showroom, escritório ou outros locais usados pelos departamentos.</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...addresses, emptyAddress(false)])}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:border-blue-400/60 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
        >
          <Plus className="h-4 w-4" /> Adicionar endereço
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {addresses.map((address, index) => (
          <div key={address.id ?? index} className="rounded-lg border border-border bg-card p-3 dark:border-slate-800 dark:bg-[#071120]">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-300">{address.type || "Endereço"}</span>
                {address.isPrimary && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">Principal</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={disabled || address.isPrimary} onClick={() => updateAddress(index, { isPrimary: true })} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold disabled:opacity-45 dark:border-slate-700">Marcar principal</button>
                <button type="button" disabled={disabled} onClick={() => duplicateAddress(index)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold disabled:opacity-45 dark:border-slate-700"><Copy className="inline h-3.5 w-3.5" /> Duplicar</button>
                <button type="button" disabled={disabled} onClick={() => removeAddress(index)} className="rounded-lg border border-red-400/30 px-2.5 py-1.5 text-xs font-bold text-red-500 disabled:opacity-45"><Trash2 className="inline h-3.5 w-3.5" /> Remover</button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SelectInput label="Tipo de endereço" value={address.type} icon={MapPin} disabled={disabled} options={addressTypes} onChange={(value) => updateAddress(index, { type: value })} />
              <TextInput label="Nome da unidade / local" value={address.locationName} icon={Building2} disabled={disabled} placeholder="Ex.: Loja Bom Retiro" onChange={(value) => updateAddress(index, { locationName: value })} />
              <TextInput label="Endereço completo" value={address.fullAddress} icon={MapPin} disabled={disabled} required placeholder="Rua, número, bairro" onChange={(value) => updateAddress(index, { fullAddress: value })} />
              <TextInput label="CEP" value={address.zipCode} icon={ClipboardCheck} disabled={disabled} placeholder="00000-000" onChange={(value) => updateAddress(index, { zipCode: value })} />
              <TextInput label="Cidade" value={address.city} icon={MapPin} disabled={disabled} onChange={(value) => updateAddress(index, { city: value })} />
              <TextInput label="Estado" value={address.state} icon={MapPin} disabled={disabled} onChange={(value) => updateAddress(index, { state: value })} />
              <TextInput label="País" value={address.country} icon={Globe2} disabled={disabled} onChange={(value) => updateAddress(index, { country: value })} />
              <TextInput label="Link Google Maps / Waze" value={address.mapsUrl} icon={Globe2} disabled={disabled} type="url" onChange={(value) => updateAddress(index, { mapsUrl: value })} />
              <TextInput label="Contato responsável no local" value={address.localContactName} icon={UserRound} disabled={disabled} onChange={(value) => updateAddress(index, { localContactName: value })} />
              <TextInput label="WhatsApp / Telefone do local" value={address.localContactPhone} icon={UserRound} disabled={disabled} onChange={(value) => updateAddress(index, { localContactPhone: value })} />
            </div>

            <div className="mt-3 rounded-lg border border-border bg-background/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="mb-2 text-xs font-bold text-muted-foreground dark:text-slate-400">Usado por quais departamentos?</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {departmentUsageOptions.map((department) => (
                  <label key={department} className="flex items-center gap-2 text-xs font-semibold text-foreground dark:text-slate-200">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={address.departmentUsage.includes(department)}
                      onChange={(event) => {
                        const usage = event.target.checked
                          ? [...address.departmentUsage, department]
                          : address.departmentUsage.filter((item) => item !== department);
                        updateAddress(index, { departmentUsage: usage });
                      }}
                    />
                    {department}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <TextAreaInput
                label="Observações do endereço"
                value={address.notes}
                icon={FileText}
                disabled={disabled}
                optional
                helper={OPTIONAL_HELPER}
                rows={2}
                onChange={(value) => updateAddress(index, { notes: value })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitorManager({
  competitors,
  disabled,
  onChange,
}: {
  competitors: Competitor[];
  disabled: boolean;
  onChange: (competitors: Competitor[]) => void;
}) {
  const updateCompetitor = (index: number, patch: Partial<Competitor>) => {
    onChange(competitors.map((competitor, currentIndex) => (currentIndex === index ? { ...competitor, ...patch } : competitor)));
  };

  return (
    <div className="mt-5 rounded-lg border border-border bg-background/60 p-4 dark:border-slate-800 dark:bg-slate-950/35">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500 dark:text-blue-300" />
            <h3 className="text-sm font-black text-foreground dark:text-white">{b2bFormLabels.competitors}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground dark:bg-slate-800 dark:text-slate-500">Opcional</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground dark:text-slate-500">Competidores são salvos como uma lista estruturada e não bloqueiam a conclusão da seção.</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...competitors, { id: createLocalId("competitor"), name: "", instagram: "", website: "" }])}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:border-blue-400/60 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
        >
          <Plus className="h-4 w-4" /> Adicionar concorrente
        </button>
      </div>

      {competitors.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground dark:border-slate-800 dark:text-slate-400">Nenhum concorrente adicionado.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {competitors.map((competitor, index) => (
            <div key={competitor.id} className="grid gap-3 rounded-lg border border-border bg-card p-3 dark:border-slate-800 dark:bg-[#071120] md:grid-cols-[1fr_1fr_1fr_auto]">
              <TextInput label="Nome" value={competitor.name} icon={Target} disabled={disabled} required placeholder="Ex.: Namine" onChange={(value) => updateCompetitor(index, { name: value })} />
              <TextInput label="Instagram" value={competitor.instagram} icon={Instagram} disabled={disabled} placeholder="@concorrente ou URL" onChange={(value) => updateCompetitor(index, { instagram: value })} />
              <TextInput label="Site" value={competitor.website} icon={Globe2} disabled={disabled} type="url" placeholder="https://..." onChange={(value) => updateCompetitor(index, { website: value })} />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(competitors.filter((_, currentIndex) => currentIndex !== index))}
                className="self-end rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-500 disabled:opacity-45"
              >
                <Trash2 className="inline h-4 w-4" /> Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommercialSection({
  sectionRef,
  values,
  canEdit,
  open,
  editing,
  onToggle,
  onAction,
  onFieldChange,
}: {
  sectionRef?: (node: HTMLElement | null) => void;
  values: FormValues;
  canEdit: boolean;
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  onAction: () => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const done =
    Number(isTextFilled(values, "commercial.acceptedDocumentRule")) +
    Number(isTextFilled(values, "commercial.minimumOrder")) +
    Number(isTextFilled(values, "commercial.paymentMethods")) +
    Number(isTextFilled(values, "commercial.discountPolicy")) +
    Number(isTextFilled(values, "commercial.restrictions")) +
    Number(isTextFilled(values, "commercial.sizeGrid")) +
    Number(isTextFilled(values, "commercial.ownManufacturing")) +
    Number(isTextFilled(values, "commercial.nationalShipping"));
  const documentRule = textValue(values, "commercial.acceptedDocumentRule");
  const selectedExplanation = documentRuleOptions.find((option) => option.value === documentRule)?.description;

  return (
    <SectionShell
      id="commercial"
      index={2}
      title={b2bFormLabels.commercialRulesSection}
      accent="amber"
      open={open}
      editing={editing}
      canEdit={canEdit}
      done={done}
      total={8}
      sectionRef={sectionRef}
      onToggle={onToggle}
      onAction={onAction}
    >
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <SelectInput
            label={b2bFormLabels.acceptedDocumentRule}
            value={documentRule}
            icon={ClipboardCheck}
            disabled={!canEdit || !editing}
            required
            helper="Defina qual tipo de cadastro o cliente aceita para compras no atacado."
            options={documentRuleOptions}
            onChange={(value) => onFieldChange("commercial.acceptedDocumentRule", value)}
          />
          {selectedExplanation && <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-200">{selectedExplanation}</p>}
        </div>
        <TextInput label={b2bFormLabels.minimumOrder} value={textValue(values, "commercial.minimumOrder")} icon={BarChart3} disabled={!canEdit || !editing} required placeholder="Ex.: Pedido mínimo de R$150" onChange={(value) => onFieldChange("commercial.minimumOrder", value)} />
        <TextInput label={b2bFormLabels.paymentMethods} value={textValue(values, "commercial.paymentMethods")} icon={ClipboardCheck} disabled={!canEdit || !editing} required placeholder="Pix, cartão, boleto, parcelamento..." onChange={(value) => onFieldChange("commercial.paymentMethods", value)} />
        <TextInput label={b2bFormLabels.discountPolicy} value={textValue(values, "commercial.discountPolicy")} icon={ClipboardCheck} disabled={!canEdit || !editing} required placeholder="Cupons, primeira compra, descontos..." onChange={(value) => onFieldChange("commercial.discountPolicy", value)} />
        <TextInput label={b2bFormLabels.commercialRestrictions} value={textValue(values, "commercial.restrictions")} icon={ShieldCheck} disabled={!canEdit || !editing} required span="full" placeholder="Geografia, categorias, estoque, regras legais..." onChange={(value) => onFieldChange("commercial.restrictions", value)} />
        <TextInput label={b2bFormLabels.sizeRange} value={textValue(values, "commercial.sizeGrid")} icon={ClipboardCheck} disabled={!canEdit || !editing} required placeholder="PP ao GG, 34 ao 48..." onChange={(value) => onFieldChange("commercial.sizeGrid", value)} />
        <SelectInput label={b2bFormLabels.ownManufacturing} value={textValue(values, "commercial.ownManufacturing")} icon={Building2} disabled={!canEdit || !editing} required options={booleanishOptions} onChange={(value) => onFieldChange("commercial.ownManufacturing", value)} />
        <SelectInput label={b2bFormLabels.nationalShipping} value={textValue(values, "commercial.nationalShipping")} icon={Globe2} disabled={!canEdit || !editing} required options={shippingOptions} onChange={(value) => onFieldChange("commercial.nationalShipping", value)} />
        <TextAreaInput label={b2bFormLabels.commercialNotes} value={textValue(values, "commercial.notes")} icon={FileText} disabled={!canEdit || !editing} optional helper={OPTIONAL_HELPER} placeholder="Contexto comercial adicional." onChange={(value) => onFieldChange("commercial.notes", value)} />
      </div>
    </SectionShell>
  );
}

function TargetSection({
  sectionRef,
  values,
  canEdit,
  open,
  editing,
  onToggle,
  onAction,
  onFieldChange,
}: {
  sectionRef?: (node: HTMLElement | null) => void;
  values: FormValues;
  canEdit: boolean;
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  onAction: () => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const done =
    Number(isTextFilled(values, "targetPositioning.positioning")) +
    Number(isTextFilled(values, "targetPositioning.brandStyle")) +
    Number(isTextFilled(values, "targetPositioning.mainAudience"));

  return (
    <SectionShell
      id="target"
      index={3}
      title={b2bFormLabels.targetSection}
      description="Defina como a marca se posiciona, qual estilo comunica e quem é o público comprador principal."
      accent="purple"
      open={open}
      editing={editing}
      canEdit={canEdit}
      done={done}
      total={3}
      sectionRef={sectionRef}
      onToggle={onToggle}
      onAction={onAction}
    >
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
        <TextAreaInput
          label={b2bFormLabels.positioning}
          value={textValue(values, "targetPositioning.positioning")}
          icon={Target}
          disabled={!canEdit || !editing}
          placeholder="Ex.: marca premium de alfaiataria feminina para lojistas que buscam peças sofisticadas..."
          onChange={(value) => onFieldChange("targetPositioning.positioning", value)}
        />
        <TextInput
          label={b2bFormLabels.brandStyle}
          value={textValue(values, "targetPositioning.brandStyle")}
          icon={Sparkles}
          disabled={!canEdit || !editing}
          required
          placeholder="Ex.: moderno, minimalista, casual chic, festa, fitness, romântico..."
          span="full"
          onChange={(value) => onFieldChange("targetPositioning.brandStyle", value)}
        />
        <TextAreaInput
          label={b2bFormLabels.mainAudience}
          value={textValue(values, "targetPositioning.mainAudience")}
          icon={Users}
          disabled={!canEdit || !editing}
          placeholder="Ex.: lojistas multimarcas, boutiques, revendedoras, lojas de moda feminina..."
          onChange={(value) => onFieldChange("targetPositioning.mainAudience", value)}
        />
        <TextInput
          label={b2bFormLabels.researchLink}
          value={textValue(values, "targetPositioning.researchLink")}
          icon={Globe2}
          disabled={!canEdit || !editing}
          optional
          helper={OPTIONAL_HELPER}
          type="url"
          placeholder="Link de pesquisa, referências, benchmarking ou documento estratégico"
          span="full"
          onChange={(value) => onFieldChange("targetPositioning.researchLink", value)}
        />
        <TextAreaInput
          label={b2bFormLabels.behaviorNotes}
          value={textValue(values, "targetPositioning.behaviorNotes")}
          icon={FileText}
          disabled={!canEdit || !editing}
          optional
          helper={OPTIONAL_HELPER}
          placeholder="Opcional — use este campo para adicionar informações extras sobre compra, sazonalidade, objeções ou comportamento do público."
          onChange={(value) => onFieldChange("targetPositioning.behaviorNotes", value)}
        />
      </div>
    </SectionShell>
  );
}

function ResponsibleBrandSection({
  sectionRef,
  values,
  canEdit,
  open,
  editing,
  onToggle,
  onAction,
  onFieldChange,
}: {
  sectionRef?: (node: HTMLElement | null) => void;
  values: FormValues;
  canEdit: boolean;
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  onAction: () => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const done = brandResponsibleRows.filter(([rowKey]) => isTextFilled(values, `brandResponsible.${rowKey}.name`)).length;
  return (
    <SectionShell
      id="brandResponsibles"
      index={4}
      title={b2bFormLabels.brandResponsiblesSection}
      accent="pink"
      open={open}
      editing={editing}
      canEdit={canEdit}
      done={done}
      total={brandResponsibleRows.length}
      sectionRef={sectionRef}
      onToggle={onToggle}
      onAction={onAction}
    >
      <div className="overflow-x-auto rounded-lg border border-border dark:border-slate-800">
        <div className="grid min-w-[1040px] grid-cols-[160px_repeat(5,minmax(140px,1fr))] gap-3 border-b border-border bg-muted/60 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-500">
          <span>Área</span>
          {responsibleColumns.map(([, label]) => <span key={label}>{label}</span>)}
        </div>
        {brandResponsibleRows.map(([rowKey, label]) => (
          <div key={rowKey} className="grid min-w-[1040px] grid-cols-[160px_repeat(5,minmax(140px,1fr))] gap-3 border-b border-border px-3 py-2 last:border-b-0 dark:border-slate-800">
            <span className="self-center text-sm font-bold text-foreground dark:text-white">{label}</span>
            {responsibleColumns.map(([columnKey]) => (
              <input
                key={columnKey}
                value={textValue(values, `brandResponsible.${rowKey}.${columnKey}`)}
                disabled={!canEdit || !editing}
                onChange={(event) => onFieldChange(`brandResponsible.${rowKey}.${columnKey}`, event.target.value)}
                className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground outline-none focus:border-blue-500 disabled:bg-muted/50 disabled:opacity-80 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white dark:disabled:bg-slate-900/60"
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <TextAreaInput
          label={b2bFormLabels.brandResponsiblesNotes}
          value={textValue(values, "brandResponsible.notes")}
          icon={FileText}
          disabled={!canEdit || !editing}
          optional
          helper={OPTIONAL_HELPER}
          rows={2}
          onChange={(value) => onFieldChange("brandResponsible.notes", value)}
        />
      </div>
    </SectionShell>
  );
}

function UpResponsibleSection({
  sectionRef,
  assignments,
  teamUsers,
  contractedServices,
  values,
  canEdit,
  open,
  editing,
  onToggle,
  onAction,
  onServiceLeaderChange,
  onFieldChange,
}: {
  sectionRef?: (node: HTMLElement | null) => void;
  assignments: ServiceAssignment[];
  teamUsers: TeamUser[];
  contractedServices: string[];
  values: FormValues;
  canEdit: boolean;
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  onAction: () => void;
  onServiceLeaderChange: (assignment: ServiceAssignment, leaderId: string) => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const rows: ServiceAssignment[] = assignments.length
    ? assignments
    : contractedServices.map((service) => ({
        id: service,
        service,
        leader_id: null,
        department_id: null,
        department_name: "Marketing B2B",
        status: "needs_mapping",
        notes: null,
        leader: null,
        department: null,
      }));
  const done = rows.filter((row) => Boolean(row.leader_id)).length;
  return (
    <SectionShell
      id="upResponsibles"
      index={5}
      title={b2bFormLabels.upResponsiblesSection}
      accent="cyan"
      open={open}
      editing={editing}
      canEdit={canEdit}
      done={done}
      total={Math.max(rows.length, 1)}
      sectionRef={sectionRef}
      onToggle={onToggle}
      onAction={onAction}
    >
      <div className="overflow-x-auto rounded-lg border border-border dark:border-slate-800">
        <div className="grid min-w-[860px] grid-cols-[1fr_1fr_1.25fr_0.9fr] gap-3 border-b border-border bg-muted/60 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-500">
          <span>Serviço</span>
          <span>Departamento UP</span>
          <span>Responsável UP</span>
          <span>Status</span>
        </div>
        {rows.map((assignment) => (
          <div key={assignment.id} className="grid min-w-[860px] grid-cols-[1fr_1fr_1.25fr_0.9fr] gap-3 border-b border-border px-3 py-2 last:border-b-0 dark:border-slate-800">
            <span className="self-center text-sm font-bold text-foreground dark:text-white">{assignment.service}</span>
            <span className="self-center text-sm text-muted-foreground dark:text-slate-300">{assignment.department?.name ?? assignment.department_name ?? "Marketing B2B"}</span>
            <select
              value={assignment.leader_id ?? ""}
              disabled={!canEdit || !editing || !assignment.id}
              onChange={(event) => onServiceLeaderChange(assignment, event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm font-semibold text-foreground outline-none focus:border-blue-500 disabled:bg-muted/50 disabled:opacity-80 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white dark:disabled:bg-slate-900/60"
            >
              <option value="">Selecionar responsável</option>
              {teamUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <span className={cn("self-center rounded-full px-2.5 py-1 text-xs font-black", statusTone(assignment.status))}>
              {assignment.leader_id ? "Assigned" : "Precisa de mapeamento"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <TextAreaInput
          label="Observações sobre responsáveis UP"
          value={textValue(values, "upResponsible.notes")}
          icon={FileText}
          disabled={!canEdit || !editing}
          optional
          helper={OPTIONAL_HELPER}
          rows={2}
          onChange={(value) => onFieldChange("upResponsible.notes", value)}
        />
      </div>
    </SectionShell>
  );
}

function AccessSection({
  sectionRef,
  values,
  canEdit,
  open,
  editing,
  onToggle,
  onAction,
  onFieldChange,
}: {
  sectionRef?: (node: HTMLElement | null) => void;
  values: FormValues;
  canEdit: boolean;
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  onAction: () => void;
  onFieldChange: (field: string, value: string) => void;
}) {
  const done = accessRows.filter(([rowKey]) => isTextFilled(values, `access.${rowKey}.status`)).length;
  return (
    <SectionShell
      id="access"
      index={6}
      title={b2bFormLabels.accessSection}
      accent="teal"
      open={open}
      editing={editing}
      canEdit={canEdit}
      done={done}
      total={accessRows.length}
      sectionRef={sectionRef}
      onToggle={onToggle}
      onAction={onAction}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {accessRows.map(([rowKey, label]) => (
          <div key={rowKey} className="rounded-lg border border-border bg-background/70 p-3 dark:border-slate-800 dark:bg-slate-950/45">
            <p className="mb-2 text-sm font-black text-foreground dark:text-white">{label}</p>
            <div className="grid gap-2 sm:grid-cols-[0.9fr_1.1fr]">
              <select
                value={textValue(values, `access.${rowKey}.status`)}
                disabled={!canEdit || !editing}
                onChange={(event) => onFieldChange(`access.${rowKey}.status`, event.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-bold text-foreground outline-none focus:border-blue-500 disabled:bg-muted/50 disabled:opacity-80 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white dark:disabled:bg-slate-900/60"
              >
                <option value="">Status</option>
                {accessStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input
                value={textValue(values, `access.${rowKey}.notes`)}
                disabled={!canEdit || !editing}
                onChange={(event) => onFieldChange(`access.${rowKey}.notes`, event.target.value)}
                placeholder="Link, usuário ou observação"
                className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-blue-500 disabled:bg-muted/50 disabled:opacity-80 dark:border-slate-800 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-600 dark:disabled:bg-slate-900/60"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <TextAreaInput
          label={b2bFormLabels.accessNotes}
          value={textValue(values, "access.notes")}
          icon={FileText}
          disabled={!canEdit || !editing}
          optional
          helper={OPTIONAL_HELPER}
          rows={2}
          onChange={(value) => onFieldChange("access.notes", value)}
        />
      </div>
    </SectionShell>
  );
}

function ValidationSection({
  sectionRef,
  values,
  progress,
  pendingSections,
  serviceAssignments,
  accessPending,
  canEdit,
  saving,
  open,
  editing,
  onToggle,
  onAction,
  onFieldChange,
  onFinalize,
}: {
  sectionRef?: (node: HTMLElement | null) => void;
  values: FormValues;
  progress: number;
  pendingSections: number;
  serviceAssignments: ServiceAssignment[];
  accessPending: number;
  canEdit: boolean;
  saving: boolean;
  open: boolean;
  editing: boolean;
  onToggle: () => void;
  onAction: () => void;
  onFieldChange: (field: string, value: string) => void;
  onFinalize: () => void;
}) {
  const missingServiceOwners = serviceAssignments.filter((assignment) => !assignment.leader_id).length;
  return (
    <SectionShell
      id="validation"
      index={7}
      title={b2bFormLabels.validationSection}
      accent="green"
      open={open}
      editing={editing}
      canEdit={canEdit}
      done={progress >= 100 ? 1 : 0}
      total={1}
      sectionRef={sectionRef}
      onToggle={onToggle}
      onAction={onAction}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ValidationItem label="Campos preenchidos" value={`${progress}%`} ok={progress >= 100} />
        <ValidationItem label="Seções pendentes" value={String(pendingSections)} ok={pendingSections === 0} />
        <ValidationItem label="Responsáveis UP faltando" value={String(missingServiceOwners)} ok={missingServiceOwners === 0} />
        <ValidationItem label="Acessos pendentes" value={String(accessPending)} ok={accessPending === 0} />
      </div>
      <div className="mt-4">
        <TextAreaInput
          label={b2bFormLabels.finalNotes}
          value={textValue(values, "validation.notes")}
          icon={FileText}
          disabled={!canEdit || !editing}
          optional
          helper={OPTIONAL_HELPER}
          rows={2}
          onChange={(value) => onFieldChange("validation.notes", value)}
        />
      </div>
      <button type="button" onClick={onFinalize} disabled={!canEdit || saving} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-sm font-black text-white shadow-[0_14px_34px_rgba(37,99,235,0.35)] disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Finalizar onboarding B2B
      </button>
    </SectionShell>
  );
}

function ValidationItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-muted-foreground dark:text-slate-300">{label}</span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-black", ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/15 text-amber-600 dark:text-amber-300")}>{value}</span>
      </div>
    </div>
  );
}

function ProgressSidebar({
  progress,
  completed,
  total,
  sections,
  activeSection,
  nextAction,
  updatedAt,
  formStatus,
  saveState,
  onSectionClick,
  onFinalize,
}: {
  progress: number;
  completed: number;
  total: number;
  sections: SectionSummary[];
  activeSection: string;
  nextAction: SectionSummary | undefined;
  updatedAt: string | null;
  formStatus: string;
  saveState: "idle" | "saving" | "saved" | "error";
  onSectionClick: (id: string) => void;
  onFinalize: () => void;
}) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-120px)] xl:self-start xl:overflow-y-auto">
      <section className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm dark:border-slate-800 dark:bg-[#06101f]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground dark:text-slate-400">Resumo do Onboarding</p>
          <Sparkles className="h-4 w-4 text-blue-500 dark:text-blue-300" />
        </div>
        <div className="mt-6 flex flex-col items-center">
          <div
            className="grid h-32 w-32 place-items-center rounded-full"
            style={{ background: `conic-gradient(rgb(37 99 235) ${progress * 3.6}deg, rgba(100,116,139,0.18) 0deg)` }}
          >
            <div className="grid h-24 w-24 place-items-center rounded-full bg-card text-center dark:bg-[#06101f]">
              <div>
                <p className="text-2xl font-black text-foreground dark:text-white">{progress}%</p>
                <p className="text-xs text-muted-foreground dark:text-slate-400">concluído</p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground dark:text-slate-300">
            <span className="font-bold text-blue-600 dark:text-blue-300">{completed}</span> de {total} campos preenchidos
          </p>
        </div>

        <div className="mt-5 border-t border-border pt-4 dark:border-slate-800">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground dark:text-slate-400">Seções</p>
          <div className="space-y-2">
            {sections.map((section) => {
              const sectionPercent = section.total > 0 ? Math.round((section.done / section.total) * 100) : 0;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSectionClick(section.id)}
                  className={cn(
                    "w-full rounded-lg px-2 py-2 text-left transition hover:bg-muted dark:hover:bg-slate-900",
                    activeSection === section.id && "bg-blue-500/10 ring-1 ring-blue-500/30",
                  )}
                >
                  <div className="mb-1 flex justify-between gap-3 text-xs font-semibold text-muted-foreground dark:text-slate-300">
                    <span className="break-words">{section.title}</span>
                    <span className="shrink-0">{section.done}/{section.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted dark:bg-slate-800">
                    <div className={cn("h-full rounded-full transition-all", accentClasses[section.accent].line)} style={{ width: `${sectionPercent}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-200">Próxima ação recomendada</p>
        <h3 className="mt-3 font-black text-foreground dark:text-white">{nextAction ? `Completar ${nextAction.title}` : "Finalizar onboarding"}</h3>
        <p className="mt-1 text-sm text-muted-foreground dark:text-slate-300">
          {nextAction ? "Complete os campos pendentes desta seção para destravar a validação final." : "Todas as seções principais estão preenchidas."}
        </p>
        <button
          type="button"
          onClick={() => (nextAction ? onSectionClick(nextAction.id) : onFinalize())}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600 px-3 py-2 text-xs font-bold text-white"
        >
          {nextAction ? "Ir para a seção" : "Finalizar onboarding B2B"}
        </button>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm dark:border-slate-800 dark:bg-[#06101f]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground dark:text-slate-400">Atividade recente</p>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground dark:text-slate-300">
          <ActivityLine icon={CheckCircle2} title={saveState === "saving" ? "Salvando alterações" : saveState === "error" ? "Erro ao salvar" : "Campos salvam automaticamente"} subtitle={updatedAt ? formatDate(updatedAt) : "Agora"} />
          <ActivityLine icon={ClipboardCheck} title={formStatus === "complete" ? "Onboarding finalizado" : "Onboarding iniciado"} subtitle={updatedAt ? formatDate(updatedAt) : "UP Flow"} />
        </div>
      </section>
    </aside>
  );
}

function ActivityLine({ icon: Icon, title, subtitle }: { icon: ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-500 dark:text-blue-300">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div>
        <p className="font-bold text-foreground dark:text-white">{title}</p>
        <p className="text-xs text-muted-foreground dark:text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function BottomSaveBar({
  saveState,
  saving,
  canEdit,
  onSave,
  onFinalize,
}: {
  saveState: "idle" | "saving" | "saved" | "error";
  saving: boolean;
  canEdit: boolean;
  onSave: () => void;
  onFinalize: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-10 mt-5 rounded-lg border border-border bg-card/95 p-4 text-card-foreground shadow-lg backdrop-blur dark:border-slate-800 dark:bg-[#06101f]/95 dark:shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground dark:text-slate-300">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", saveState === "error" ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300")}>
            {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : saveState === "error" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          </span>
          <span>{saveState === "saving" ? "Salvando automaticamente..." : saveState === "error" ? "Erro ao salvar. Tente novamente." : "As alterações são salvas automaticamente."}</span>
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold", saveState === "error" ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300")}>
            {saveState === "saving" ? "Salvando..." : saveState === "error" ? "Erro ao salvar" : "Tudo salvo"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onSave} disabled={!canEdit || saving} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold text-foreground hover:border-blue-400/60 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
            <Save className="h-4 w-4" /> Salvar resumo
          </button>
          <button type="button" onClick={onFinalize} disabled={!canEdit || saving} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2 text-sm font-black text-white shadow-[0_14px_34px_rgba(37,99,235,0.35)] disabled:opacity-50">
            <Check className="h-4 w-4" /> Finalizar onboarding B2B
          </button>
        </div>
      </div>
    </div>
  );
}

function KanbanPlaceholder({ taskTitle, taskStatus }: { taskTitle: string; taskStatus: string }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 text-card-foreground dark:border-slate-800 dark:bg-[#06101f]">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground dark:text-slate-400">Kanban / tarefas</p>
      <div className="mt-4 rounded-lg border border-border bg-background/70 p-4 dark:border-slate-800 dark:bg-slate-950/45">
        <p className="font-black text-foreground dark:text-white">{taskTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">Status: {taskStatus}</p>
        <p className="mt-3 text-sm text-muted-foreground dark:text-slate-400">
          O formulário é a interface principal. A tarefa continua sendo usada como controle de workflow em segundo plano.
        </p>
      </div>
    </section>
  );
}
