import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = join(__dirname, "..", "..", "src", "app", "api");

function findRouteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      findRouteFiles(full, out);
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

test("every API route exports its handlers through withErrorReporting", () => {
  const files = findRouteFiles(API_ROOT);
  assert.ok(files.length > 0, "expected to find at least one API route");

  const unwrapped: string[] = [];

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = relative(API_ROOT, file);

    // Find any bare exported HTTP handlers like:
    //   export async function POST(...) { ... }
    //   export function GET(...) { ... }
    // These bypass the error tracker and must be refactored to use
    // `withErrorReporting` like the rest of the routes.
    for (const method of HTTP_METHODS) {
      const bare = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${method}\\b`,
      );
      if (bare.test(src)) {
        unwrapped.push(`${rel}: bare 'export function ${method}'`);
      }
    }

    // If the file exports any HTTP method at all, it must import the
    // wrapper. (A route file that exports nothing isn't a real route.)
    const exportsAnyMethod = HTTP_METHODS.some((m) =>
      new RegExp(`export\\s+(?:const|async\\s+function|function)\\s+${m}\\b`).test(src),
    );
    if (exportsAnyMethod && !/from\s+["']@\/lib\/with-error-reporting["']/.test(src)) {
      unwrapped.push(`${rel}: missing import of withErrorReporting`);
    }

    // Each `export const METHOD = ...` must be assigned from a
    // `withErrorReporting("api:<bucket>:<METHOD>", ...)` call. This
    // catches the loophole where a file imports the wrapper but then
    // exports a handler directly (e.g. `export const GET = getHandler`).
    for (const method of HTTP_METHODS) {
      const exportConst = new RegExp(
        `export\\s+const\\s+${method}\\s*(?::[^=]+)?=\\s*([\\s\\S]*?);`,
      );
      const m = src.match(exportConst);
      if (!m) continue;
      const rhs = m[1];
      const wrapped = new RegExp(
        `withErrorReporting\\s*\\(\\s*["'\`]api:[^"'\`]+:${method}["'\`]\\s*,`,
      );
      if (!wrapped.test(rhs)) {
        unwrapped.push(
          `${rel}: 'export const ${method}' is not assigned from ` +
            `withErrorReporting("api:<bucket>:${method}", ...)`,
        );
      }
    }
  }

  assert.deepEqual(
    unwrapped,
    [],
    `Found API routes that bypass withErrorReporting:\n  - ${unwrapped.join("\n  - ")}\n` +
      `Wrap each handler like:\n` +
      `  async function getHandler(req: NextRequest) { ... }\n` +
      `  export const GET = withErrorReporting("api:<bucket>:GET", getHandler);`,
  );
});
