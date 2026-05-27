export function normalizePhone(input: string | null | undefined): string | null {
  const value = input?.trim();
  return value ? value : null;
}

export function isPhoneLikeName(input: string | null | undefined): boolean {
  const value = input?.trim();
  if (!value) return false;

  const digits = value.replace(/\D/g, "");
  const letters = value.replace(/[^a-zA-ZÀ-ÿ]/g, "");

  return digits.length >= 7 && letters.length === 0;
}

export function normalizeDisplayName(
  input: string | null | undefined,
  email: string,
  phone?: string | null,
): string {
  const value = input?.trim();
  const emailFallback = email.split("@")[0] || email;
  const sameAsPhone =
    Boolean(value && phone) && value!.replace(/\D/g, "") === phone!.replace(/\D/g, "");

  if (!value || isPhoneLikeName(value) || sameAsPhone) {
    return emailFallback;
  }

  return value;
}
