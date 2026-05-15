import { z } from "zod";
import type { CustomFieldType } from "@/lib/types";

const TEXT_MAX = 2000;
const NUMBER_MAX = 1e15;

// Accept either `YYYY-MM-DD` (the format the <input type="date"> control emits)
// or a full ISO-8601 timestamp. We do not rely on `new Date(s)` alone because
// it silently auto-corrects invalid calendar dates (e.g. 2026-02-31 → March 3).
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const FULL_ISO =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function isCalendarDateValid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

const isoDate = z
  .string()
  .min(1)
  .refine((s) => {
    const dateOnly = DATE_ONLY.exec(s);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      return isCalendarDateValid(Number(y), Number(m), Number(d));
    }
    const iso = FULL_ISO.exec(s);
    if (!iso) return false;
    const [, y, m, d] = iso;
    if (!isCalendarDateValid(Number(y), Number(m), Number(d))) return false;
    // Round-trip through Date to catch impossible time components (25:00 etc.)
    const t = new Date(s).getTime();
    return !Number.isNaN(t);
  }, "must be a valid date (YYYY-MM-DD or ISO-8601)");

const userId = z.string().uuid("must be a valid user id");

/**
 * Whether a value should be treated as "cleared". Cleared values are always
 * valid — the caller is expected to delete the row instead of writing it.
 */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

interface DefLite {
  type: CustomFieldType;
  name: string;
  // Stored as JSON in Prisma; accept the broader shape and normalize internally.
  options: unknown;
}

function asStringArray(opts: unknown): string[] {
  return Array.isArray(opts) ? opts.filter((o): o is string => typeof o === "string") : [];
}

export interface ValidationOk {
  ok: true;
  /** Value coerced into its canonical form (e.g. number, ISO date string). */
  value: unknown;
}
export interface ValidationFail {
  ok: false;
  error: string;
}
export type ValidationResult = ValidationOk | ValidationFail;

/**
 * Validate a single custom-field value against its definition. Returns the
 * normalized value (e.g. number coerced from numeric string) on success, or
 * a structured error string on failure.
 *
 * Empty values are allowed (used for "clear this field"). The caller decides
 * whether to delete the row or skip it.
 */
export function validateCustomFieldValue(
  def: DefLite,
  value: unknown,
): ValidationResult {
  if (isEmptyValue(value)) return { ok: true, value: null };

  switch (def.type) {
    case "text": {
      const r = z
        .string()
        .max(TEXT_MAX, `must be ≤ ${TEXT_MAX} characters`)
        .safeParse(value);
      return r.success
        ? { ok: true, value: r.data }
        : { ok: false, error: firstError(r.error) };
    }
    case "number": {
      let n: number;
      if (typeof value === "number") n = value;
      else if (typeof value === "string" && value.trim() !== "") n = Number(value);
      else return { ok: false, error: "must be a number" };
      if (!Number.isFinite(n)) return { ok: false, error: "must be a finite number" };
      if (Math.abs(n) > NUMBER_MAX) {
        return { ok: false, error: `must be between -${NUMBER_MAX} and ${NUMBER_MAX}` };
      }
      return { ok: true, value: n };
    }
    case "date": {
      const r = isoDate.safeParse(value);
      return r.success
        ? { ok: true, value: new Date(r.data).toISOString() }
        : { ok: false, error: firstError(r.error) };
    }
    case "checkbox": {
      if (typeof value === "boolean") return { ok: true, value };
      return { ok: false, error: "must be a boolean" };
    }
    case "dropdown": {
      const options = asStringArray(def.options);
      const r = z.string().safeParse(value);
      if (!r.success) return { ok: false, error: "must be one of the defined options" };
      if (!options.includes(r.data)) {
        return { ok: false, error: `must be one of: ${options.join(", ") || "(no options defined)"}` };
      }
      return { ok: true, value: r.data };
    }
    case "people": {
      const arr = Array.isArray(value) ? value : null;
      if (!arr) return { ok: false, error: "must be an array of user ids" };
      const seen = new Set<string>();
      for (const v of arr) {
        const r = userId.safeParse(v);
        if (!r.success) return { ok: false, error: "all entries must be valid user ids" };
        seen.add(r.data);
      }
      return { ok: true, value: Array.from(seen) };
    }
  }
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "invalid value";
}

/**
 * Validate a batch of `{ definition_id, value }` entries against the supplied
 * definitions, returning a map of normalized values keyed by definition id.
 * Stops on the first failure and returns the offending field name + error.
 */
export function validateCustomFieldBatch(
  defs: Array<{ id: string; name: string; type: CustomFieldType; options: unknown }>,
  entries: Array<{ definition_id: string; value: unknown }>,
): { ok: true; normalized: Map<string, unknown> } | { ok: false; field: string; error: string } {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const normalized = new Map<string, unknown>();
  for (const entry of entries) {
    const def = byId.get(entry.definition_id);
    if (!def) {
      return { ok: false, field: entry.definition_id, error: "unknown custom field" };
    }
    const r = validateCustomFieldValue(def, entry.value);
    if (!r.ok) return { ok: false, field: def.name, error: r.error };
    normalized.set(entry.definition_id, r.value);
  }
  return { ok: true, normalized };
}
