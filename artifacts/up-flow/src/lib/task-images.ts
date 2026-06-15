const IMAGE_URL_MAX_LENGTH = 2_000;

export function isValidTaskImageUrl(value: string) {
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
  return isValidTaskImageUrl(value) ? value : "invalid";
}
