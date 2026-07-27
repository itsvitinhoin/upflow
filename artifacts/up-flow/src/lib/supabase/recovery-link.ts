const RECOVERY_VERIFY_PATH = "/auth/v1/verify";

export type PasswordRecoveryConfirmationUrlOptions = {
  appOrigin: string;
  actionLink: string;
};

export type PasswordRecoveryActionLinkOptions = {
  hash: string;
  supabaseUrl: string | undefined;
  expectedRedirectTo: string;
};

export type PasswordRecoveryActionLinkValidationOptions = {
  actionLink: string;
  supabaseUrl: string | undefined;
  expectedRedirectTo: string;
};

/**
 * Wrap Supabase's single-use action link in an app-controlled confirmation
 * screen. The action link stays in the URL fragment, which browsers do not
 * send to servers, proxies, or referrers. A person must explicitly continue
 * from that screen before Supabase consumes the one-time token.
 */
export function createPasswordRecoveryConfirmationUrl({
  appOrigin,
  actionLink,
}: PasswordRecoveryConfirmationUrlOptions): string {
  const confirmationUrl = new URL("/auth/reset/confirm", appOrigin);
  confirmationUrl.hash = new URLSearchParams({ action: actionLink }).toString();
  return confirmationUrl.toString();
}

/**
 * Read and strictly validate the action link before the confirmation screen
 * follows it. This prevents the screen from becoming an open redirect and
 * ensures it is only used for this app's Supabase recovery callback.
 */
export function getPasswordRecoveryActionLink({
  hash,
  supabaseUrl,
  expectedRedirectTo,
}: PasswordRecoveryActionLinkOptions): string | null {
  const actionLink = new URLSearchParams(hash.replace(/^#/, "")).get("action");
  if (!actionLink) return null;

  return validatePasswordRecoveryActionLink({
    actionLink,
    supabaseUrl,
    expectedRedirectTo,
  });
}

/**
 * Validate a recovery action URL supplied by our server-side confirmation
 * state. Keeping this validation shared with the legacy fragment flow avoids
 * turning the confirmation endpoint into an open redirect.
 */
export function validatePasswordRecoveryActionLink({
  actionLink,
  supabaseUrl,
  expectedRedirectTo,
}: PasswordRecoveryActionLinkValidationOptions): string | null {
  if (!supabaseUrl) return null;

  try {
    const actionUrl = new URL(actionLink);
    const configuredSupabaseOrigin = new URL(supabaseUrl).origin;
    const redirectTo = actionUrl.searchParams.get("redirect_to");

    if (
      actionUrl.origin !== configuredSupabaseOrigin ||
      actionUrl.pathname !== RECOVERY_VERIFY_PATH ||
      actionUrl.searchParams.get("type") !== "recovery" ||
      (!actionUrl.searchParams.get("token") && !actionUrl.searchParams.get("token_hash")) ||
      !redirectTo ||
      !sameUrl(redirectTo, expectedRedirectTo)
    ) {
      return null;
    }

    return actionUrl.toString();
  } catch {
    return null;
  }
}

function sameUrl(left: string, right: string): boolean {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    leftUrl.hash = "";
    rightUrl.hash = "";
    return leftUrl.toString() === rightUrl.toString();
  } catch {
    return false;
  }
}
