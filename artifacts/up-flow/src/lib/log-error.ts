/**
 * Standardized error logger. All catch blocks that don't surface to the user
 * via toast should call this so logs share a single grep-able shape.
 *
 *   logError("api:tasks:POST", err, { project_id })
 *
 * Output line shape:
 *   [upflow] api:tasks:POST  Error: <message>  {context...}
 */
export function logError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();
  const stack = error instanceof Error ? error.stack : undefined;
  const ctx = context && Object.keys(context).length > 0 ? context : undefined;
  // Use a single console.error call so log shippers keep the entry together.
  if (stack) {
    console.error(`[upflow] ${scope}`, message, ctx ?? "", "\n", stack);
  } else {
    console.error(`[upflow] ${scope}`, message, ctx ?? "");
  }
}
