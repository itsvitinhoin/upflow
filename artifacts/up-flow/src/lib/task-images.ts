const IMAGE_URL_MAX_LENGTH = 2_000;
export const TASK_ASSET_PREFIX = "task-asset://";

// Storage paths are deliberately constrained so a task asset reference cannot
// escape its three-part workspace/uploader/file naming scheme.
const ASSET_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;

function normalizeTaskAssetPath(path: string): string | null {
  const segments = path.split("/");
  if (segments.length !== 3 || segments.some((segment) => !ASSET_SEGMENT.test(segment))) {
    return null;
  }
  return segments.join("/");
}

export function createTaskAssetReference(path: string): string | null {
  const normalized = normalizeTaskAssetPath(path);
  return normalized ? `${TASK_ASSET_PREFIX}${normalized}` : null;
}

export function getTaskAssetPath(value: string | null | undefined): string | null {
  if (!value?.startsWith(TASK_ASSET_PREFIX)) return null;
  return normalizeTaskAssetPath(value.slice(TASK_ASSET_PREFIX.length));
}

export function isValidTaskImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value.length <= IMAGE_URL_MAX_LENGTH;
  } catch {
    return false;
  }
}

function isLegacyTaskImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      value.length <= IMAGE_URL_MAX_LENGTH
    );
  } catch {
    return false;
  }
}

export function parseTaskImageUrl(input: unknown): string | null | "invalid" {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "string") return "invalid";
  const value = input.trim();
  if (!value) return null;
  return getTaskAssetPath(value) || isValidTaskImageUrl(value) ? value : "invalid";
}

/** Convert a stored private asset reference into an authorized app route. */
export function getTaskCoverDisplayUrl(value: string | null | undefined): string | null {
  const assetPath = getTaskAssetPath(value);
  if (assetPath) {
    return `/api/task-assets/${assetPath.split("/").map(encodeURIComponent).join("/")}`;
  }
  return value && isLegacyTaskImageUrl(value) ? value : null;
}
