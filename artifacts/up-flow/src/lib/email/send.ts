import { logError } from "@/lib/log-error";

/**
 * Transactional email sender for Up Flow.
 *
 * Backed by Resend's REST API (https://resend.com/docs/api-reference/emails).
 * We avoid the `resend` npm SDK so the same helper works in any runtime
 * (Edge, Node, tests) without extra deps — Resend is a thin HTTPS POST.
 *
 * Behavior:
 *   - If RESEND_API_KEY is set, the email is sent via Resend.
 *   - If it is NOT set, we log the rendered email to the server console at
 *     INFO level so local development never silently swallows mail. Callers
 *     still get a resolved `{ ok: true, devMode: true }`.
 *   - All provider failures are caught + logged. The caller decides whether
 *     to surface them to the user. We NEVER throw out of `sendEmail` so a
 *     bad SMTP day cannot 500 a user-facing request.
 */

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  /** Optional reply-to address (e.g. the inviter). */
  replyTo?: string;
  /** Stable scope tag used in logs; defaults to "email". */
  scope?: string;
}

export interface SendEmailResult {
  ok: boolean;
  devMode?: boolean;
  id?: string;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Default From address. Override with EMAIL_FROM env. The default uses
 * Resend's sandbox domain so a freshly provisioned account works out of
 * the box without DNS setup; production deployments should set their own.
 */
function getFromAddress(): string {
  return process.env.EMAIL_FROM || "Up Flow <onboarding@resend.dev>";
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const scope = input.scope ?? "email";
  const apiKey = process.env.RESEND_API_KEY;
  const to = Array.isArray(input.to) ? input.to : [input.to];

  if (!apiKey) {
    // Dev fallback: write the email to the server log so we don't lose it.
    console.info(
      `[upflow] ${scope}:dev-mail  RESEND_API_KEY not set; not sending.\n` +
        `  to:      ${to.join(", ")}\n` +
        `  subject: ${input.subject}\n` +
        `  text:\n${indent(input.text, "    ")}`,
    );
    return { ok: true, devMode: true };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      const msg = body.message || body.name || `HTTP ${res.status}`;
      logError(`${scope}:send`, new Error(msg), { to });
      return { ok: false, error: msg };
    }
    return { ok: true, id: body.id };
  } catch (err) {
    logError(`${scope}:send`, err, { to });
    return { ok: false, error: (err as Error).message };
  }
}

function indent(s: string, prefix: string): string {
  return s
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

/** True when the email backend is configured to actually send. */
export function emailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
