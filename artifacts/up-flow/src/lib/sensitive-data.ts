const SENSITIVE_KEY = /(?:authorization|cookie|password|token|api[_-]?key|secret|dsn|email|e-mail|phone|mobile|recipient|address|contact|full_?name|(^|_)name$)/i;
const SENSITIVE_VALUE = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{6,}\d)/i;

/** Redact secrets and user-identifying values before they reach logs or Sentry. */
export function scrubSensitiveContext(
  input?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!input) return undefined;
  return scrubRecord(input, 0);
}

function scrubRecord(input: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : scrubValue(value, depth + 1);
  }
  return out;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") {
    return SENSITIVE_VALUE.test(value) ? "[redacted]" : value;
  }
  if (Array.isArray(value)) {
    return depth > 5 ? "[truncated]" : value.map((item) => scrubValue(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return depth > 5 ? "[truncated]" : scrubRecord(value as Record<string, unknown>, depth + 1);
  }
  return value;
}
