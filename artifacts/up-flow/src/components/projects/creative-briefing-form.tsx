"use client";

import { type ChangeEvent, type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Globe2,
  ImageIcon,
  Layers3,
  Link2,
  Loader2,
  Paperclip,
  Save,
  Send,
  Upload,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import BrazilianDateInput from "@/components/ui/brazilian-date-input";
import {
  addBusinessDaysToIsoDate,
  buildCreativeBriefingDescription,
  buildCreativeBriefingTitle,
  filterCreativeBriefingDesigners,
  type CreativeBriefingPriority,
} from "@/lib/creative-briefing";
import { cn } from "@/lib/utils";
import type { AppUser, Task, TaskAssignee } from "@/lib/types";

interface CreativeBriefingFormProps {
  projectId: string;
  workspaceId: string;
  users: TaskAssignee[];
  me: AppUser | null;
  onCreated: (task: Task) => void | Promise<void>;
  onDesignerRosterConfigured: () => void | Promise<void>;
}

interface CompanyOption {
  id: string;
  name: string;
}

type DeadlinePreset = "standard" | "rush" | "extended" | "custom";

interface DraftState {
  designerIds: string[];
  companyId: string;
  videoSizes: string[];
  formats: string[];
  brandRules: string;
  description: string;
  driveUrl: string;
  visualReferenceUrl: string;
  priority: CreativeBriefingPriority;
  deadlinePreset: DeadlinePreset;
  customDueDate: string;
}

type StoredDraftState = Partial<DraftState> & {
  designerId?: string;
  videoSize?: string;
  format?: string;
};

const DRAFT_PREFIX = "upflow.creative-briefing";
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
const MAX_DRIVE_FILES = 5;

const VIDEO_SIZES = ["1:1 - 1080 x 1080", "4:5 - 1080 x 1350", "9:16 - 1080 x 1920", "16:9 - 1920 x 1080"];

const FORMAT_VALUES = [
  { value: "carousel", hours: 2, icon: Layers3 },
  { value: "banner", hours: 1, icon: FileText },
  { value: "single_image", hours: 1, icon: ImageIcon },
  { value: "video_edit", hours: 1, icon: Video },
] as const;

function isSupportedCreativeFile(file: File) {
  const acceptedTypes = ["image/png", "image/jpeg", "application/pdf"];
  if (acceptedTypes.includes(file.type)) return true;
  return /\.(png|jpe?g|pdf)$/i.test(file.name);
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function CreativeBriefingForm({
  projectId,
  workspaceId,
  users,
  me,
  onCreated,
  onDesignerRosterConfigured,
}: CreativeBriefingFormProps) {
  const { language, t } = useLanguage();
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [designerIds, setDesignerIds] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [videoSizes, setVideoSizes] = useState<string[]>([VIDEO_SIZES[2]]);
  const [formats, setFormats] = useState<string[]>(["carousel"]);
  const [brandRules, setBrandRules] = useState("");
  const [briefDescription, setBriefDescription] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [driveFiles, setDriveFiles] = useState<File[]>([]);
  const [visualReferenceUrl, setVisualReferenceUrl] = useState("");
  const [priority, setPriority] = useState<CreativeBriefingPriority>("medium");
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset>("standard");
  const [customDueDate, setCustomDueDate] = useState("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [referenceUrlPreviewFailed, setReferenceUrlPreviewFailed] = useState(false);
  const [draggingDriveFiles, setDraggingDriveFiles] = useState(false);
  const [draggingReference, setDraggingReference] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [designerSetupOpen, setDesignerSetupOpen] = useState(false);
  const [designerSetupIds, setDesignerSetupIds] = useState<string[]>([]);
  const [savingDesignerRoster, setSavingDesignerRoster] = useState(false);
  const driveFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatOptions = useMemo(
    () =>
      FORMAT_VALUES.map((option) => ({
        ...option,
        label: t(`creativeBrief.format.${option.value}`),
      })),
    [t],
  );
  const designerUsers = useMemo(() => filterCreativeBriefingDesigners(users), [users]);
  const designerIdSet = useMemo(
    () => new Set(designerUsers.map((designer) => designer.id)),
    [designerUsers],
  );
  const requesterName = me?.name?.trim() || me?.email || t("creativeBrief.requesterUnknown");
  const canConfigureDesignerRoster =
    me?.role === "admin" || me?.currentRole === "owner" || me?.currentRole === "admin";
  const selectedDesigners = designerIds.flatMap((designerId) => {
    const designer = designerUsers.find((user) => user.id === designerId);
    return designer ? [designer] : [];
  });
  const primaryDesigner = selectedDesigners[0] ?? null;
  const selectedFormats = formatOptions.filter((option) => formats.includes(option.value));
  const selectedCompany = companies.find((company) => company.id === companyId) ?? null;
  const estimatedHours = selectedFormats.reduce((total, option) => total + option.hours, 0);

  const dueDate = useMemo(() => {
    if (deadlinePreset === "custom") return customDueDate;
    const days = deadlinePreset === "rush" ? 1 : deadlinePreset === "extended" ? 3 : 2;
    return addBusinessDaysToIsoDate(new Date(), days);
  }, [customDueDate, deadlinePreset]);

  const dueDateLabel = useMemo(() => {
    if (deadlinePreset === "custom") {
      return customDueDate ? t("creativeBrief.deadlineCustomSet") : t("creativeBrief.deadlineChooseDate");
    }
    const days = deadlinePreset === "rush" ? 1 : deadlinePreset === "extended" ? 3 : 2;
    return t("creativeBrief.deadlineBusinessDays", { count: days });
  }, [customDueDate, deadlinePreset, t]);

  const referenceUrlPreview =
    visualReferenceUrl.trim() && isHttpUrl(visualReferenceUrl.trim()) && !referenceUrlPreviewFailed
      ? visualReferenceUrl.trim()
      : null;
  const referencePreviewSource = referenceImagePreview ?? referenceUrlPreview;

  useEffect(() => {
    const controller = new AbortController();
    setCompaniesLoading(true);
    fetch(`/api/companies?limit=100&workspace_id=${encodeURIComponent(workspaceId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as { items?: CompanyOption[] };
      })
      .then((data) => setCompanies(data.items ?? []))
      .catch(() => {
        if (!controller.signal.aborted) toast.error(t("creativeBrief.loadBrandsFailed"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCompaniesLoading(false);
      });
    return () => controller.abort();
  }, [t, workspaceId]);

  useEffect(() => {
    if (!draftLoaded) return;
    setDesignerIds((current) => {
      const next = current.filter((designerId) => designerIdSet.has(designerId));
      return next.length === current.length ? current : next;
    });
  }, [designerIdSet, draftLoaded]);

  useEffect(() => {
    setReferenceUrlPreviewFailed(false);
  }, [visualReferenceUrl]);

  useEffect(() => {
    if (!referenceFile || !/^image\/(png|jpeg)$/.test(referenceFile.type)) {
      setReferenceImagePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(referenceFile);
    setReferenceImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [referenceFile]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${DRAFT_PREFIX}.${projectId}`);
      if (!stored) return;
      const draft = JSON.parse(stored) as StoredDraftState;
      if (Array.isArray(draft.designerIds)) {
        setDesignerIds(draft.designerIds.filter((id): id is string => typeof id === "string"));
      } else if (typeof draft.designerId === "string") {
        setDesignerIds([draft.designerId]);
      }
      if (typeof draft.companyId === "string") setCompanyId(draft.companyId);
      if (Array.isArray(draft.videoSizes)) {
        setVideoSizes(
          draft.videoSizes.filter(
            (value): value is string => typeof value === "string" && VIDEO_SIZES.includes(value),
          ),
        );
      } else if (typeof draft.videoSize === "string") {
        setVideoSizes([draft.videoSize]);
      }
      if (Array.isArray(draft.formats)) {
        setFormats(
          draft.formats.filter(
            (value): value is string =>
              typeof value === "string" && FORMAT_VALUES.some((item) => item.value === value),
          ),
        );
      } else if (draft.format && FORMAT_VALUES.some((item) => item.value === draft.format)) {
        setFormats([draft.format]);
      }
      if (typeof draft.brandRules === "string") setBrandRules(draft.brandRules);
      if (typeof draft.description === "string") setBriefDescription(draft.description);
      if (typeof draft.driveUrl === "string") setDriveUrl(draft.driveUrl);
      if (typeof draft.visualReferenceUrl === "string") setVisualReferenceUrl(draft.visualReferenceUrl);
      if (draft.priority === "low" || draft.priority === "medium" || draft.priority === "high") {
        setPriority(draft.priority);
      }
      if (["standard", "rush", "extended", "custom"].includes(draft.deadlinePreset ?? "")) {
        setDeadlinePreset(draft.deadlinePreset as DeadlinePreset);
      }
      if (typeof draft.customDueDate === "string") setCustomDueDate(draft.customDueDate);
      toast.success(t("creativeBrief.draftRestored"));
    } catch {
      localStorage.removeItem(`${DRAFT_PREFIX}.${projectId}`);
    } finally {
      setDraftLoaded(true);
    }
  }, [projectId, t]);

  const formDraft = (): DraftState => ({
    designerIds,
    companyId,
    videoSizes,
    formats,
    brandRules,
    description: briefDescription,
    driveUrl,
    visualReferenceUrl,
    priority,
    deadlinePreset,
    customDueDate,
  });

  const saveDraft = () => {
    try {
      localStorage.setItem(`${DRAFT_PREFIX}.${projectId}`, JSON.stringify(formDraft()));
      toast.success(
        referenceFile || driveFiles.length > 0
          ? t("creativeBrief.draftSavedWithFileNote")
          : t("creativeBrief.draftSaved"),
      );
    } catch {
      toast.error(t("creativeBrief.draftSaveFailed"));
    }
  };

  const saveDesignerRoster = async () => {
    if (designerSetupIds.length === 0) {
      toast.error(t("creativeBrief.setupDesignersRequired"));
      return;
    }

    setSavingDesignerRoster(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/creative-designers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: designerSetupIds }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || t("creativeBrief.setupDesignersFailed"));
      }

      await onDesignerRosterConfigured();
      setDesignerIds(designerSetupIds);
      setDesignerSetupOpen(false);
      toast.success(t("creativeBrief.setupDesignersSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("creativeBrief.setupDesignersFailed"));
    } finally {
      setSavingDesignerRoster(false);
    }
  };

  const isValidCreativeFile = (file: File) => {
    if (!isSupportedCreativeFile(file)) {
      toast.error(t("creativeBrief.fileTypeError"));
      return false;
    }
    if (file.size === 0 || file.size > MAX_REFERENCE_BYTES) {
      toast.error(t("creativeBrief.fileSizeError"));
      return false;
    }
    return true;
  };

  const chooseReferenceFile = (file: File | undefined) => {
    if (!file || !isValidCreativeFile(file)) return;
    setReferenceFile(file);
  };

  const addDriveFiles = (files: FileList | File[]) => {
    const candidates = Array.from(files).filter((file) => isValidCreativeFile(file));
    const seen = new Set(driveFiles.map(fileKey));
    const additions = candidates.filter((file) => {
      const key = fileKey(file);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const remaining = Math.max(0, MAX_DRIVE_FILES - driveFiles.length);
    if (additions.length > remaining) {
      toast.error(t("creativeBrief.driveFileLimit", { count: MAX_DRIVE_FILES }));
    }
    if (remaining > 0 && additions.length > 0) {
      setDriveFiles((current) => [...current, ...additions.slice(0, remaining)]);
    }
  };

  const onDriveFilesInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addDriveFiles(event.target.files);
    event.target.value = "";
  };

  const onDriveFilesDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDraggingDriveFiles(false);
    addDriveFiles(event.dataTransfer.files);
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    chooseReferenceFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onReferenceDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDraggingReference(false);
    chooseReferenceFile(event.dataTransfer.files?.[0]);
  };

  const uploadCreativeAsset = async (
    taskId: string,
    file: File,
    assetRole: "reference" | "drive_file",
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("asset_role", assetRole);
    const uploadResponse = await fetch(`/api/tasks/${taskId}/creative-reference`, {
      method: "POST",
      body: formData,
    });
    const uploaded = (await uploadResponse.json().catch(() => ({}))) as {
      reference?: string;
      file_name?: string;
      error?: string;
    };
    if (!uploadResponse.ok || !uploaded.reference) {
      throw new Error(uploaded.error || t("creativeBrief.attachmentUploadFailed"));
    }
    return { fileName: uploaded.file_name ?? file.name, reference: uploaded.reference };
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!primaryDesigner) {
      toast.error(t("creativeBrief.designerRequired"));
      return;
    }
    if (!selectedCompany) {
      toast.error(t("creativeBrief.brandRequired"));
      return;
    }
    if (videoSizes.length === 0) {
      toast.error(t("creativeBrief.videoSizeRequired"));
      return;
    }
    if (selectedFormats.length === 0) {
      toast.error(t("creativeBrief.formatRequired"));
      return;
    }
    if (!dueDate) {
      toast.error(t("creativeBrief.deadlineRequired"));
      return;
    }
    if (driveUrl.trim() && !isHttpUrl(driveUrl.trim())) {
      toast.error(t("creativeBrief.invalidDriveUrl"));
      return;
    }
    if (visualReferenceUrl.trim() && !isHttpUrl(visualReferenceUrl.trim())) {
      toast.error(t("creativeBrief.invalidReferenceUrl"));
      return;
    }

    setSubmitting(true);
    try {
      const descriptionInput = {
        designerNames: selectedDesigners.map((designer) => designer.name),
        requesterName,
        brandName: selectedCompany.name,
        videoSizes,
        formats: selectedFormats.map((option) => option.label),
        brandRules,
        description: briefDescription,
        driveUrl,
        visualReferenceUrl,
        priority,
        dueDate,
        estimatedHours,
      };
      const description = buildCreativeBriefingDescription(
        {
          ...descriptionInput,
          driveFiles: driveFiles.map((file) => ({ name: file.name })),
          referenceFileName: referenceFile?.name,
        },
        language,
      );
      const createResponse = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: buildCreativeBriefingTitle(
            selectedCompany.name,
            selectedFormats.map((option) => option.label).join(", "),
            language,
          ),
          description,
          status: "todo",
          priority,
          project_id: projectId,
          company_id: selectedCompany.id,
          assignee_id: primaryDesigner.id,
          due_date: dueDate,
        }),
      });
      const created = (await createResponse.json().catch(() => ({}))) as Task & { error?: string };
      if (!createResponse.ok || !created.id) {
        throw new Error(created.error || t("creativeBrief.submitFailed"));
      }

      let attachmentsUploadFailed = false;
      const uploadedDriveFiles = await Promise.all(
        driveFiles.map(async (file) => {
          try {
            return await uploadCreativeAsset(created.id, file, "drive_file");
          } catch {
            attachmentsUploadFailed = true;
            return null;
          }
        }),
      );
      let uploadedReference: { fileName: string; reference: string } | null = null;
      if (referenceFile) {
        try {
          uploadedReference = await uploadCreativeAsset(created.id, referenceFile, "reference");
        } catch {
          attachmentsUploadFailed = true;
        }
      }

      if (uploadedReference || uploadedDriveFiles.some((file) => file !== null)) {
        try {
          const updatedDescription = buildCreativeBriefingDescription(
            {
              ...descriptionInput,
              driveFiles: driveFiles.map((file, index) => ({
                name: uploadedDriveFiles[index]?.fileName ?? file.name,
                url: uploadedDriveFiles[index]?.reference,
              })),
              referenceFileName: uploadedReference?.fileName ?? referenceFile?.name,
              referenceFileUrl: uploadedReference?.reference,
            },
            language,
          );
          const patchResponse = await fetch(`/api/tasks/${created.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: updatedDescription }),
          });
          if (!patchResponse.ok) throw new Error(t("creativeBrief.attachmentUploadFailed"));
        } catch {
          attachmentsUploadFailed = true;
        }
      }

      localStorage.removeItem(`${DRAFT_PREFIX}.${projectId}`);
      setCompanyId("");
      setVideoSizes([VIDEO_SIZES[2]]);
      setFormats(["carousel"]);
      setBrandRules("");
      setBriefDescription("");
      setDriveUrl("");
      setDriveFiles([]);
      setVisualReferenceUrl("");
      setPriority("medium");
      setDeadlinePreset("standard");
      setCustomDueDate("");
      setReferenceFile(null);
      await onCreated(created);
      toast.success(t("creativeBrief.submitted"));
      if (attachmentsUploadFailed) toast.error(t("creativeBrief.submittedAttachmentsFailed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("creativeBrief.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#2a5ca9] bg-[#020a1b] p-3 text-slate-100 shadow-[0_18px_55px_rgba(1,12,37,0.45)] sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "linear-gradient(rgba(57,132,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(57,132,255,0.10) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="pointer-events-none absolute -right-28 top-8 h-56 w-56 rounded-full border border-blue-400/25" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-36 -left-20 h-64 w-64 rounded-full border border-cyan-400/20" aria-hidden="true" />

      <form onSubmit={submit} className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-[#4476c4] bg-[#041126]/95 shadow-[0_0_48px_rgba(23,107,255,0.18)]">
        <header className="border-b border-[#305993] px-5 py-6 sm:px-9 sm:py-8">
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#4d8cf4] bg-[#0a2144] shadow-[0_0_24px_rgba(48,117,255,0.28)] sm:h-16 sm:w-16">
              <FileText className="h-7 w-7 text-[#4c9cff]" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-normal text-white sm:text-4xl">{t("creativeBrief.title")}</p>
              <p className="mt-1 text-sm text-[#a8bad9] sm:text-lg">{t("creativeBrief.subtitle")}</p>
              <p className="mt-3 text-sm text-[#c7d8f3]">
                <span className="font-semibold text-[#8fbaff]">{t("creativeBrief.requester")}:</span>{" "}
                <span className="font-semibold text-white">{requesterName}</span>
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-7 px-5 py-6 sm:px-9 sm:py-8">
          <div className="grid gap-5 md:grid-cols-2 md:gap-x-10">
            <BriefField label={t("creativeBrief.designer")} required>
              <MultiSelectField
                values={designerIds}
                onChange={setDesignerIds}
                disabled={submitting || designerUsers.length === 0}
                options={designerUsers.map((user) => ({ value: user.id, label: user.name }))}
              />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-[#92a8cb]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#4d95ff]" />
                {t("creativeBrief.designerHint")}
              </p>
              {designerUsers.length === 0 ? (
                <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                  <p className="text-xs text-amber-200">
                    {canConfigureDesignerRoster
                      ? t("creativeBrief.noDesignersAdmin")
                      : t("creativeBrief.noDesigners")}
                  </p>
                  {canConfigureDesignerRoster ? (
                    <div className="mt-3">
                      {!designerSetupOpen ? (
                        <button
                          type="button"
                          onClick={() => setDesignerSetupOpen(true)}
                          disabled={submitting}
                          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#5ca4ff] bg-[#0b2d61] px-3 text-xs font-semibold text-white transition hover:bg-[#123d7d] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <UsersRound className="h-4 w-4" />
                          {t("creativeBrief.setupDesigners")}
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {t("creativeBrief.setupDesignersTitle")}
                            </p>
                            <p className="mt-1 text-xs text-[#b9c9e5]">
                              {t("creativeBrief.setupDesignersDescription")}
                            </p>
                          </div>
                          <MultiSelectField
                            values={designerSetupIds}
                            onChange={setDesignerSetupIds}
                            disabled={savingDesignerRoster}
                            options={users.map((user) => ({ value: user.id, label: user.name }))}
                          />
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDesignerSetupOpen(false)}
                              disabled={savingDesignerRoster}
                              className="min-h-9 rounded-md border border-[#486b9f] px-3 text-xs font-semibold text-[#d7e5ff] transition hover:bg-[#10284c] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {t("common.cancel")}
                            </button>
                            <button
                              type="button"
                              onClick={saveDesignerRoster}
                              disabled={savingDesignerRoster || designerSetupIds.length === 0}
                              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-[#1767e8] px-3 text-xs font-semibold text-white transition hover:bg-[#2b7df4] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingDesignerRoster ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UsersRound className="h-3.5 w-3.5" />}
                              {t("creativeBrief.setupDesignersSave")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </BriefField>

            <BriefField label={t("creativeBrief.brand")} required>
              <SelectField
                value={companyId}
                onChange={setCompanyId}
                disabled={submitting || companiesLoading}
                placeholder={companiesLoading ? t("common.loading") : t("creativeBrief.select")}
                options={companies.map((company) => ({ value: company.id, label: company.name }))}
              />
              {!companiesLoading && companies.length === 0 ? (
                <p className="mt-2 text-xs text-amber-300">{t("creativeBrief.noBrands")}</p>
              ) : null}
            </BriefField>

            <BriefField label={t("creativeBrief.videoSize")}>
              <MultiSelectField
                values={videoSizes}
                onChange={setVideoSizes}
                disabled={submitting}
                options={VIDEO_SIZES.map((value) => ({ value, label: value }))}
              />
              <p className="mt-2 text-xs text-[#92a8cb]">{t("creativeBrief.multiSelectHint")}</p>
            </BriefField>

            <BriefField label={t("creativeBrief.format")}>
              <MultiSelectField
                values={formats}
                onChange={setFormats}
                disabled={submitting}
                options={formatOptions.map((option) => ({ value: option.value, label: option.label }))}
              />
              <p className="mt-2 text-xs text-[#92a8cb]">{t("creativeBrief.multiSelectHint")}</p>
            </BriefField>
          </div>

          <BriefField label={t("creativeBrief.brandRules")}>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-[#96b7e8]" />
              <textarea
                value={brandRules}
                onChange={(event) => setBrandRules(event.target.value)}
                disabled={submitting}
                placeholder={t("creativeBrief.brandRulesPlaceholder")}
                className="min-h-28 w-full resize-y rounded-lg border border-[#385b91] bg-[#07162e] py-3 pl-12 pr-4 text-base text-white placeholder:text-[#7689aa] outline-none transition focus:border-[#4f95ff] focus:ring-2 focus:ring-[#2679ff]/25 disabled:opacity-60"
              />
            </div>
          </BriefField>

          <BriefField label={t("creativeBrief.description")}>
            <textarea
              value={briefDescription}
              onChange={(event) => setBriefDescription(event.target.value)}
              disabled={submitting}
              placeholder={t("creativeBrief.descriptionPlaceholder")}
              className="min-h-36 w-full resize-y rounded-lg border border-[#385b91] bg-[#07162e] px-4 py-3 text-base text-white placeholder:text-[#7689aa] outline-none transition focus:border-[#4f95ff] focus:ring-2 focus:ring-[#2679ff]/25 disabled:opacity-60"
            />
          </BriefField>

          <BriefField label={t("creativeBrief.driveUrl")}>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] md:items-center">
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#96b7e8]" />
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(event) => setDriveUrl(event.target.value)}
                  disabled={submitting}
                  placeholder="https://"
                  className="h-[52px] w-full rounded-lg border border-[#385b91] bg-[#07162e] py-3 pl-12 pr-4 text-base text-white placeholder:text-[#7689aa] outline-none transition focus:border-[#4f95ff] focus:ring-2 focus:ring-[#2679ff]/25 disabled:opacity-60"
                />
              </div>
              <span className="hidden text-center text-sm text-[#a5b8d7] md:block">{t("creativeBrief.or")}</span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => driveFileInputRef.current?.click()}
                onDragEnter={() => setDraggingDriveFiles(true)}
                onDragLeave={() => setDraggingDriveFiles(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDriveFilesDrop}
                className={cn(
                  "flex min-h-[52px] items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-3 text-left transition",
                  draggingDriveFiles
                    ? "border-[#5ca0ff] bg-[#10366b]/70"
                    : "border-[#3b679e] bg-[#06162d] hover:border-[#5ca0ff] hover:bg-[#0b2144]",
                  submitting && "cursor-not-allowed opacity-60",
                )}
              >
                <Upload className="h-5 w-5 shrink-0 text-[#89b4f5]" />
                <span className="text-sm font-semibold text-white">{t("creativeBrief.driveUpload")}</span>
              </button>
              <input
                ref={driveFileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,application/pdf"
                className="hidden"
                onChange={onDriveFilesInput}
              />
            </div>
            <p className="mt-2 text-xs text-[#92a8cb]">{t("creativeBrief.driveUploadHint")}</p>
            {driveFiles.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {driveFiles.map((file) => (
                  <li
                    key={fileKey(file)}
                    className="flex items-center gap-2 rounded-lg border border-[#315c94] bg-[#081a34] px-3 py-2 text-sm text-[#d7e5ff]"
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-[#75adff]" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-[#9eb7dd]">{Math.ceil(file.size / 1024)} KB</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDriveFiles((current) =>
                          current.filter((candidate) => fileKey(candidate) !== fileKey(file)),
                        )
                      }
                      className="rounded p-1 text-[#b4c9e9] transition hover:bg-white/10 hover:text-white"
                      aria-label={t("creativeBrief.removeFile")}
                      title={t("creativeBrief.removeFile")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </BriefField>

          <BriefField label={t("creativeBrief.visualReference")}>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] md:items-center">
              <div className="relative">
                <Globe2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#96b7e8]" />
                <input
                  type="url"
                  value={visualReferenceUrl}
                  onChange={(event) => setVisualReferenceUrl(event.target.value)}
                  disabled={submitting}
                  placeholder="https://"
                  className="h-[52px] w-full rounded-lg border border-[#385b91] bg-[#07162e] py-3 pl-12 pr-4 text-base text-white placeholder:text-[#7689aa] outline-none transition focus:border-[#4f95ff] focus:ring-2 focus:ring-[#2679ff]/25 disabled:opacity-60"
                />
              </div>
              <span className="hidden text-center text-sm text-[#a5b8d7] md:block">{t("creativeBrief.or")}</span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={() => setDraggingReference(true)}
                onDragLeave={() => setDraggingReference(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onReferenceDrop}
                className={cn(
                  "flex min-h-28 items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-4 text-left transition",
                  draggingReference
                    ? "border-[#5ca0ff] bg-[#10366b]/70"
                    : "border-[#3b679e] bg-[#06162d] hover:border-[#5ca0ff] hover:bg-[#0b2144]",
                  submitting && "cursor-not-allowed opacity-60",
                )}
              >
                <Upload className="h-7 w-7 shrink-0 text-[#89b4f5]" />
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-white">{t("creativeBrief.upload")}</span>
                  <span className="mt-1 block text-xs text-[#9fb3d4]">{t("creativeBrief.uploadHint")}</span>
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                className="hidden"
                onChange={onFileInput}
              />
            </div>
            {referenceFile ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#315c94] bg-[#081a34] px-3 py-2 text-sm text-[#d7e5ff]">
                <Paperclip className="h-4 w-4 shrink-0 text-[#75adff]" />
                <span className="min-w-0 flex-1 truncate">{referenceFile.name}</span>
                <span className="shrink-0 text-xs text-[#9eb7dd]">{Math.ceil(referenceFile.size / 1024)} KB</span>
                <button
                  type="button"
                  onClick={() => setReferenceFile(null)}
                  className="rounded p-1 text-[#b4c9e9] transition hover:bg-white/10 hover:text-white"
                  aria-label={t("creativeBrief.removeFile")}
                  title={t("creativeBrief.removeFile")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {referencePreviewSource ? (
              <figure className="mt-4 overflow-hidden rounded-lg border border-[#315c94] bg-[#06162d]">
                <div className="flex items-center justify-between gap-3 border-b border-[#2d568c] px-3 py-2">
                  <figcaption className="text-xs font-semibold text-[#d7e5ff]">
                    {t("creativeBrief.visualPreview")}
                  </figcaption>
                  {referenceImagePreview ? (
                    <span className="text-xs text-[#9eb7dd]">{referenceFile?.name}</span>
                  ) : null}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={referencePreviewSource}
                  alt={t("creativeBrief.visualPreview")}
                  onError={() => {
                    if (!referenceImagePreview) setReferenceUrlPreviewFailed(true);
                  }}
                  className="aspect-video w-full bg-[#020a1b] object-contain"
                />
              </figure>
            ) : null}
          </BriefField>

          <div className="grid gap-7 md:grid-cols-2 md:gap-x-10">
            <BriefField label={t("creativeBrief.priority")}>
              <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[#385b91] bg-[#07162e] p-1">
                {(["low", "medium", "high"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={submitting}
                    onClick={() => setPriority(option)}
                    aria-pressed={priority === option}
                    className={cn(
                      "min-h-12 rounded-md px-2 text-sm font-semibold transition",
                      priority === option
                        ? "bg-[#1767e8] text-white shadow-[0_0_18px_rgba(45,131,255,0.55)]"
                        : "text-[#a9bade] hover:bg-[#11284b] hover:text-white",
                    )}
                  >
                    {t(`creativeBrief.priority.${option}`)}
                  </button>
                ))}
              </div>
            </BriefField>

            <BriefField label={t("creativeBrief.deadline")}>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(["standard", "rush", "extended", "custom"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={submitting}
                      onClick={() => setDeadlinePreset(preset)}
                      aria-pressed={deadlinePreset === preset}
                      className={cn(
                        "min-h-12 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
                        deadlinePreset === preset
                          ? "border-[#4c9cff] bg-[#0b2d61] text-white shadow-[0_0_18px_rgba(39,126,255,0.22)]"
                          : "border-[#385b91] bg-[#07162e] text-[#b8cae8] hover:border-[#5a8ed4] hover:bg-[#0a2040]",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 shrink-0 text-[#66a6ff]" />
                        {t(`creativeBrief.deadline.${preset}`)}
                      </span>
                    </button>
                  ))}
                </div>
                {deadlinePreset === "custom" ? (
                  <BrazilianDateInput
                    value={customDueDate}
                    onChange={setCustomDueDate}
                    disabled={submitting}
                    className="h-12 w-full rounded-lg border border-[#385b91] bg-[#07162e] px-4 text-sm text-white outline-none transition placeholder:text-[#7689aa] focus:border-[#4f95ff] focus:ring-2 focus:ring-[#2679ff]/25"
                  />
                ) : (
                  <p className="text-xs text-[#99b0d2]">{dueDateLabel}</p>
                )}
              </div>
            </BriefField>
          </div>

          <section className="border-t border-[#2b5187] pt-6">
            <div className="flex items-center gap-3 text-white">
              <Clock3 className="h-5 w-5 text-[#66a6ff]" />
              <h3 className="text-lg font-semibold">{t("creativeBrief.estimatedTime")}</h3>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {formatOptions.map((option) => {
                const Icon = option.icon;
                const selected = formats.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      setFormats((current) => toggleMultiSelectValue(current, option.value))
                    }
                    aria-pressed={selected}
                    className={cn(
                      "min-h-28 rounded-lg border p-4 text-left transition",
                      selected
                        ? "border-[#4c9cff] bg-[#0b2d61] shadow-[0_0_22px_rgba(39,126,255,0.24)]"
                        : "border-[#385b91] bg-[#07162e] hover:border-[#5a8ed4] hover:bg-[#0a2040]",
                    )}
                  >
                    <Icon className="h-7 w-7 text-[#4e9cff]" />
                    <span className="mt-3 block text-sm font-semibold text-white">{option.label}</span>
                    <span className="mt-1 block text-2xl font-bold text-[#5ca4ff]">{option.hours}h</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-[#2b5187] px-5 py-5 sm:flex-row sm:justify-end sm:px-9">
          <button
            type="button"
            onClick={saveDraft}
            disabled={submitting || !draftLoaded}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#5a81bd] bg-[#07172f] px-5 text-sm font-semibold text-white transition hover:border-[#78aaff] hover:bg-[#0c2850] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {t("creativeBrief.saveDraft")}
          </button>
          <button
            type="submit"
            disabled={submitting || companiesLoading || companies.length === 0 || designerUsers.length === 0}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#55a4ff] bg-[#1468eb] px-6 text-sm font-semibold text-white shadow-[0_0_24px_rgba(37,122,255,0.48)] transition hover:bg-[#2a7cf4] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("creativeBrief.submit")}
          </button>
        </footer>
      </form>
    </div>
  );
}

function BriefField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-2 block text-base font-semibold text-white">
        {label}
        {required ? <span className="ml-1 text-[#7bb0ff]">*</span> : null}
      </span>
      {children}
    </div>
  );
}

function toggleMultiSelectValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((selectedValue) => selectedValue !== value)
    : [...values, value];
}

function MultiSelectField({
  values,
  onChange,
  options,
  disabled,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-[#385b91] bg-[#07162e] p-2">
      <div className="grid gap-1 sm:grid-cols-2">
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                selected
                  ? "bg-[#0b2d61] text-white"
                  : "text-[#c6d6ee] hover:bg-[#10284c]",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(toggleMultiSelectValue(values, option.value))}
                className="h-4 w-4 shrink-0 rounded border-[#5b7faf] bg-[#041126] text-[#3e88ff] focus:ring-2 focus:ring-[#2679ff]/45"
              />
              <span className="min-w-0 break-words font-medium">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-[52px] w-full appearance-none rounded-lg border border-[#385b91] bg-[#07162e] px-4 pr-11 text-base text-white outline-none transition focus:border-[#4f95ff] focus:ring-2 focus:ring-[#2679ff]/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a8bee3]" />
    </div>
  );
}
