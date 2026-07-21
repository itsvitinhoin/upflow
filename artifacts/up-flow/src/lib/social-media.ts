import type { CustomFieldType, Prisma } from "@prisma/client";
import { appDateKey, appDateTimeToUtc } from "@/lib/utils";

/**
 * Stable custom-field names for the Creative & Design > Social Media list.
 * Keeping these names in one place lets the calendar API and the list
 * provisioning code address the exact same fields without magic strings.
 */
export const SOCIAL_MEDIA_FIELD_NAMES = {
  contentType: "Content Type",
  scheduledPublishingDate: "Scheduled Publishing Date",
  socialMediaManager: "Social Media Manager",
  designer: "Designer",
  moodboardStatus: "Moodboard Status",
  creativeProductionStatus: "Creative Production Status",
  approvalStatus: "Approval Status",
  publishingStatus: "Publishing Status",
  publishedUrl: "Published URL",
  publishedAt: "Published At",
} as const;

export type SocialMediaCustomFieldName =
  (typeof SOCIAL_MEDIA_FIELD_NAMES)[keyof typeof SOCIAL_MEDIA_FIELD_NAMES];

export const SOCIAL_MEDIA_CONTENT_TYPE_OPTIONS = [
  "Static Post",
  "Carousel",
  "Reel",
  "Story",
  "Video",
  "Live",
  "Other",
];

export const SOCIAL_MEDIA_MOODBOARD_STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Ready",
  "Awaiting Approval",
  "Approved",
];

export const SOCIAL_MEDIA_CREATIVE_PRODUCTION_STATUS_OPTIONS = [
  "Not Requested",
  "In Production",
  "In Review",
  "Awaiting Approval",
  "Approved",
  "Scheduled",
];

export const SOCIAL_MEDIA_APPROVAL_STATUS_OPTIONS = [
  "Not Requested",
  "Awaiting Approval",
  "Approved",
  "Changes Requested",
];

export const SOCIAL_MEDIA_PUBLISHING_STATUS_OPTIONS = [
  "Not Scheduled",
  "Scheduled",
  "Published",
  "Overdue",
  "Cancelled",
];

export type SocialMediaMoodboardStatus =
  (typeof SOCIAL_MEDIA_MOODBOARD_STATUS_OPTIONS)[number];

export type SocialMediaCustomFieldDefinition = {
  name: SocialMediaCustomFieldName;
  type: CustomFieldType;
  options?: string[];
  position: number;
};

/** The column contract used by both the list provisioner and calendar APIs. */
export const SOCIAL_MEDIA_CUSTOM_FIELD_DEFINITIONS: SocialMediaCustomFieldDefinition[] = [
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.contentType,
    type: "dropdown",
    options: [...SOCIAL_MEDIA_CONTENT_TYPE_OPTIONS],
    position: 0,
  },
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.scheduledPublishingDate,
    type: "date",
    position: 1,
  },
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.socialMediaManager,
    type: "people",
    position: 2,
  },
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.designer,
    type: "people",
    position: 3,
  },
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.moodboardStatus,
    type: "dropdown",
    options: [...SOCIAL_MEDIA_MOODBOARD_STATUS_OPTIONS],
    position: 4,
  },
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.creativeProductionStatus,
    type: "dropdown",
    options: [...SOCIAL_MEDIA_CREATIVE_PRODUCTION_STATUS_OPTIONS],
    position: 5,
  },
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.approvalStatus,
    type: "dropdown",
    options: [...SOCIAL_MEDIA_APPROVAL_STATUS_OPTIONS],
    position: 6,
  },
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.publishingStatus,
    type: "dropdown",
    options: [...SOCIAL_MEDIA_PUBLISHING_STATUS_OPTIONS],
    position: 7,
  },
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.publishedUrl,
    type: "text",
    position: 8,
  },
  {
    name: SOCIAL_MEDIA_FIELD_NAMES.publishedAt,
    type: "text",
    position: 9,
  },
];

/** List-level workflow labels for projects provisioned as the Social Media list. */
export const SOCIAL_MEDIA_WORKFLOW_STATUSES = [
  { key: "social_media_not_started", name: "Not Started", color: "#94A3B8" },
  { key: "social_media_in_production", name: "In Production", color: "#8B5CF6" },
  { key: "social_media_in_review", name: "In Review", color: "#F59E0B" },
  { key: "social_media_awaiting_approval", name: "Awaiting Approval", color: "#EAB308" },
  { key: "social_media_scheduled", name: "Scheduled", color: "#3B82F6" },
  { key: "social_media_published", name: "Published", color: "#22C55E", terminal: true },
  { key: "social_media_overdue", name: "Overdue", color: "#EF4444" },
  { key: "social_media_cancelled", name: "Cancelled", color: "#64748B", terminal: true },
];

/** Structural match for DepartmentListPreset; deliberately avoids a circular import. */
export const SOCIAL_MEDIA_LIST_PRESET: {
  name: string;
  description: string;
  custom_fields: SocialMediaCustomFieldDefinition[];
  workflow_statuses: Array<{
    key: string;
    name: string;
    color?: string;
    terminal?: boolean;
  }>;
} = {
  name: "Social Media",
  description:
    "Centralized client content planning, creative production, approval, scheduling, and publishing.",
  custom_fields: SOCIAL_MEDIA_CUSTOM_FIELD_DEFINITIONS,
  workflow_statuses: SOCIAL_MEDIA_WORKFLOW_STATUSES,
};

export const SOCIAL_MEDIA_DEFAULT_CONTENT_TYPE = SOCIAL_MEDIA_CONTENT_TYPE_OPTIONS[0];
export const SOCIAL_MEDIA_DEFAULT_MOODBOARD_STATUS: SocialMediaMoodboardStatus = "Not Started";

export function isSocialMediaMoodboardStatus(value: unknown): value is SocialMediaMoodboardStatus {
  return (
    typeof value === "string" &&
    SOCIAL_MEDIA_MOODBOARD_STATUS_OPTIONS.includes(value as SocialMediaMoodboardStatus)
  );
}

export function isMoodboardReady(status: string | null | undefined): boolean {
  return status === "Ready" || status === "Approved";
}

export function moodboardStatusForTaskStatus(
  taskStatus: "todo" | "in_progress" | "done",
  currentStatus?: SocialMediaMoodboardStatus | null,
): SocialMediaMoodboardStatus {
  // Generic task statuses have less detail than the Social Media moodboard
  // workflow. Preserve a richer state whenever the two systems express the
  // same stage (done/Approved and in-progress/Awaiting Approval).
  if (taskStatus === "done") return currentStatus === "Approved" ? "Approved" : "Ready";
  if (taskStatus === "in_progress") {
    return currentStatus === "Awaiting Approval" ? "Awaiting Approval" : "In Progress";
  }
  return "Not Started";
}

export function moodboardTaskStatusFor(
  moodboardStatus: SocialMediaMoodboardStatus,
): "todo" | "in_progress" | "done" {
  if (moodboardStatus === "Ready" || moodboardStatus === "Approved") return "done";
  if (moodboardStatus === "In Progress" || moodboardStatus === "Awaiting Approval") {
    return "in_progress";
  }
  return "todo";
}

function validCalendarMonth(year: number, month: number) {
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12;
}

/** Parse a calendar month and normalize it to noon in the app time zone. */
export function parseSocialMediaMonth(value: unknown): Date | "invalid" {
  if (typeof value !== "string") return "invalid";
  const match = value.trim().match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match) return "invalid";
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!validCalendarMonth(year, month)) return "invalid";
  return appDateTimeToUtc(year, month, 1, 12, 0);
}

export function socialMediaMonthKey(month: Date | string): string {
  return appDateKey(month).slice(0, 7);
}

export function socialMediaMonthLabel(month: Date | string): string {
  const [year, monthNumber] = socialMediaMonthKey(month).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function monthParts(month: Date | string): { year: number; month: number } {
  const [year, numericMonth] = socialMediaMonthKey(month).split("-").map(Number);
  return { year, month: numericMonth };
}

function daysInCalendarMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function evenlySelect<T>(values: T[], count: number): T[] {
  if (count <= 0 || values.length === 0) return [];
  const selected: T[] = [];
  for (let index = 0; index < count; index += 1) {
    const valueIndex = Math.min(
      values.length - 1,
      Math.floor(((index + 0.5) * values.length) / count),
    );
    selected.push(values[valueIndex]);
  }
  return selected;
}

/**
 * Create deterministic publication dates inside a month. It favors evenly
 * spaced weekdays implied by the weekly cadence; when the contractual target
 * exceeds that cadence, the target wins and dates are distributed across all
 * days of the month.
 */
export function scheduleSocialMediaDates(
  month: Date | string,
  monthlyPostTarget: number,
  weeklyPostingFrequency: number,
): Date[] {
  const target = Math.max(0, Math.floor(monthlyPostTarget));
  if (target === 0) return [];

  const { year, month: numericMonth } = monthParts(month);
  const days = daysInCalendarMonth(year, numericMonth);
  const allDays = Array.from({ length: days }, (_, index) => index + 1);
  const frequency = Math.max(1, Math.min(7, Math.floor(weeklyPostingFrequency) || 1));
  const preferredWeekdays = new Set(
    Array.from({ length: frequency }, (_, index) =>
      Math.floor(((index + 1) * 7) / (frequency + 1)),
    ),
  );
  const cadenceDays = allDays.filter((day) =>
    preferredWeekdays.has(new Date(Date.UTC(year, numericMonth - 1, day)).getUTCDay()),
  );
  const source = cadenceDays.length >= target ? cadenceDays : allDays;

  return evenlySelect(source, target).map((day) =>
    appDateTimeToUtc(year, numericMonth, day, 12, 0),
  );
}

export function isDateInSocialMediaMonth(value: Date | string, month: Date | string): boolean {
  return socialMediaMonthKey(value) === socialMediaMonthKey(month);
}

/**
 * Publication dates are calendar commitments, rather than timestamps. Compare
 * their app-time-zone date keys so a post due today is never made overdue just
 * because its stored instant happens to be earlier than the current time.
 */
export function isSocialMediaPublicationOverdue(
  dueDate: Date | string | null | undefined,
  now = new Date(),
): boolean {
  return Boolean(dueDate) && appDateKey(dueDate!) < appDateKey(now);
}

const PRODUCTION_READY_FOR_APPROVAL = [
  "In Review",
  "Awaiting Approval",
  "Approved",
  "Scheduled",
];

const PRODUCTION_READY_FOR_PUBLISHING = ["Approved", "Scheduled"];

export const SOCIAL_MEDIA_APPROVAL_GATE_ERROR =
  "Approval Status can only advance after Creative Production Status reaches In Review.";

export const SOCIAL_MEDIA_PRODUCTION_GATE_ERROR =
  "Creative Production Status must move one stage at a time after the moodboard is ready.";

export const SOCIAL_MEDIA_PUBLISHED_URL_REQUIRED_ERROR =
  "A Published URL is required before Publishing Status can be set to Published.";

export const SOCIAL_MEDIA_PUBLISHING_GATE_ERROR =
  "Publishing Status can only be set to Scheduled or Published after Creative Production is Approved or Scheduled and Approval Status is Approved.";

const PRODUCTION_STAGE_ORDER = [
  "Not Requested",
  "In Production",
  "In Review",
  "Awaiting Approval",
  "Approved",
  "Scheduled",
];

/**
 * Keep the creative lifecycle ordered. Moving a post backward for rework is
 * valid, while jumping ahead bypasses the review and approval handoff.
 */
export function canAdvanceSocialMediaProduction(
  nextStatus: string | null | undefined,
  currentStatus: string | null | undefined,
  moodboardStatus: string | null | undefined,
  approvalStatus?: string | null,
): boolean {
  const next = nextStatus ?? "Not Requested";
  const current = currentStatus ?? "Not Requested";
  if (next === current || next === "Not Requested") return true;
  if (!isMoodboardReady(moodboardStatus ?? "")) return false;
  const nextIndex = PRODUCTION_STAGE_ORDER.indexOf(next);
  const currentIndex = PRODUCTION_STAGE_ORDER.indexOf(current);
  if (nextIndex < 0 || currentIndex < 0) return false;
  if (next === "Scheduled" && approvalStatus !== "Approved") return false;
  return nextIndex <= currentIndex || nextIndex === currentIndex + 1;
}

/** Enforce that approval begins only after the creative reaches review. */
export function canAdvanceSocialMediaApproval(
  approvalStatus: string | null | undefined,
  creativeProductionStatus: string | null | undefined,
): boolean {
  if (approvalStatus === "Not Requested" || approvalStatus === "Changes Requested") return true;
  if (approvalStatus === "Awaiting Approval") {
    return PRODUCTION_READY_FOR_APPROVAL.includes(creativeProductionStatus ?? "");
  }
  if (approvalStatus === "Approved") {
    return ["Awaiting Approval", "Approved", "Scheduled"].includes(
      creativeProductionStatus ?? "",
    );
  }
  return false;
}

/** Enforce that scheduled and published items have cleared both prior stages. */
export function canSetSocialMediaPublishingStatus(
  publishingStatus: string | null | undefined,
  approvalStatus: string | null | undefined,
  creativeProductionStatus: string | null | undefined,
): boolean {
  if (publishingStatus !== "Scheduled" && publishingStatus !== "Published") return true;
  return (
    approvalStatus === "Approved" &&
    PRODUCTION_READY_FOR_PUBLISHING.includes(creativeProductionStatus ?? "")
  );
}

/** Pick the next available scheduled date for a manually added post. */
export function nextSocialMediaScheduledDate(
  month: Date | string,
  weeklyPostingFrequency: number,
  existingDates: Array<Date | string | null | undefined>,
): Date {
  const existing = new Set(
    existingDates
      .filter((date): date is Date | string => Boolean(date))
      .map((date) => appDateKey(date)),
  );
  const { year, month: numericMonth } = monthParts(month);
  const days = daysInCalendarMonth(year, numericMonth);
  const candidateCount = Math.max(existing.size + 1, weeklyPostingFrequency * 5);
  const scheduled = scheduleSocialMediaDates(month, candidateCount, weeklyPostingFrequency);
  const available = scheduled.find((date) => !existing.has(appDateKey(date)));
  if (available) return available;

  for (let day = 1; day <= days; day += 1) {
    const date = appDateTimeToUtc(year, numericMonth, day, 12, 0);
    if (!existing.has(appDateKey(date))) return date;
  }
  return appDateTimeToUtc(year, numericMonth, days, 12, 0);
}

function sameOptions(current: unknown, expected: string[]) {
  if (!Array.isArray(current)) return expected.length === 0;
  const strings = current.filter((item): item is string => typeof item === "string");
  return strings.length === expected.length && strings.every((item, index) => item === expected[index]);
}

type SocialMediaFieldStore = Pick<Prisma.TransactionClient, "customFieldDefinition">;

export type SocialMediaFieldIds = Record<SocialMediaCustomFieldName, string>;

/**
 * Ensure the Social Media list has every calendar field. This runs inside the
 * plan transaction so concurrent plan creation cannot leave partially
 * provisioned fields behind.
 */
export async function ensureSocialMediaCustomFields(
  db: SocialMediaFieldStore,
  projectId: string,
): Promise<SocialMediaFieldIds> {
  const existing = await db.customFieldDefinition.findMany({
    where: { project_id: projectId },
    select: { id: true, name: true, type: true, options: true, position: true },
    orderBy: [{ position: "asc" }, { created_at: "asc" }],
  });
  const byName = new Map(existing.map((field) => [field.name, field]));
  const fieldIds = {} as SocialMediaFieldIds;

  for (const definition of SOCIAL_MEDIA_CUSTOM_FIELD_DEFINITIONS) {
    const current = byName.get(definition.name);
    if (!current) {
      const created = await db.customFieldDefinition.create({
        data: {
          project_id: projectId,
          name: definition.name,
          type: definition.type,
          position: definition.position,
          ...(definition.type === "dropdown"
            ? { options: definition.options as Prisma.InputJsonValue }
            : {}),
        },
        select: { id: true },
      });
      fieldIds[definition.name] = created.id;
      continue;
    }

    const expectedOptions = definition.options ?? [];
    const needsUpdate =
      current.type !== definition.type ||
      current.position !== definition.position ||
      (definition.type === "dropdown" && !sameOptions(current.options, expectedOptions));
    if (needsUpdate) {
      await db.customFieldDefinition.update({
        where: { id: current.id },
        data: {
          type: definition.type,
          position: definition.position,
          ...(definition.type === "dropdown"
            ? { options: expectedOptions as Prisma.InputJsonValue }
            : {}),
        },
      });
    }
    fieldIds[definition.name] = current.id;
  }

  return fieldIds;
}
