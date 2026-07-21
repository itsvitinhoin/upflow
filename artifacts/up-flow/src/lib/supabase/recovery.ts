/**
 * Complete a Supabase password-recovery callback regardless of whether Auth
 * returns a PKCE code in the query string or legacy session tokens in the URL
 * fragment. Both formats are issued by supported Supabase recovery flows.
 */
export type PasswordRecoveryAuthClient = {
  auth: {
    exchangeCodeForSession(code: string): Promise<{ error: unknown | null }>;
    setSession(session: {
      access_token: string;
      refresh_token: string;
    }): Promise<{ error: unknown | null }>;
  };
};

export type PasswordRecoveryLocation = {
  search: string;
  hash: string;
};

export type PasswordRecoveryResult = "ready" | "invalid";

export async function establishPasswordRecoverySession(
  client: PasswordRecoveryAuthClient,
  location: PasswordRecoveryLocation,
): Promise<PasswordRecoveryResult> {
  const query = new URLSearchParams(location.search);
  const code = query.get("code");

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    return error ? "invalid" : "ready";
  }

  const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");

  if (!accessToken || !refreshToken || fragment.get("type") !== "recovery") {
    return "invalid";
  }

  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return error ? "invalid" : "ready";
}
