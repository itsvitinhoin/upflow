#!/usr/bin/env node
/**
 * One-shot codemod: wrap every `export async function METHOD(...)` in
 * `src/app/api/**\/route.ts` with `withErrorReporting`.
 *
 * Skips:
 *  - any file that already imports `withErrorReporting` (already done)
 *  - `health/route.ts` (deliberately bare — it IS the error surface)
 *  - `auth/test-login/route.ts` (dev-only, doesn't need tracker noise)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_ROOT = join(ROOT, "src/app/api");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const SKIP = new Set(["health/route.ts", "auth/test-login/route.ts"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name === "route.ts") yield p;
  }
}

function deriveScope(absPath) {
  const rel = relative(API_ROOT, absPath).replace(/\/route\.ts$/, "");
  return "api:" + rel.replace(/\[(.+?)\]/g, "$1");
}

let changed = 0;
for (const file of walk(API_ROOT)) {
  const rel = relative(API_ROOT, file);
  if (SKIP.has(rel)) continue;
  let src = readFileSync(file, "utf8");
  if (src.includes('from "@/lib/with-error-reporting"')) continue;

  const methodsFound = [];
  for (const m of METHODS) {
    const re = new RegExp(`^export async function ${m}\\(`, "m");
    if (re.test(src)) {
      methodsFound.push(m);
      src = src.replace(re, `async function ${m}_handler(`);
    }
  }
  if (methodsFound.length === 0) continue;

  // Insert the import after the last existing import line.
  const lines = src.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) lastImport = i;
  }
  const importLine = `import { withErrorReporting } from "@/lib/with-error-reporting";`;
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine);
  } else {
    lines.unshift(importLine);
  }
  src = lines.join("\n");

  // Append wrapped exports.
  const scope = deriveScope(file);
  const tail =
    "\n" +
    methodsFound
      .map(
        (m) =>
          `export const ${m} = withErrorReporting("${scope}:${m}", ${m}_handler);`,
      )
      .join("\n") +
    "\n";
  src = src.replace(/\s*$/, "") + tail;
  writeFileSync(file, src);
  console.log(`wrapped ${rel} [${methodsFound.join(",")}]`);
  changed++;
}
console.log(`done — ${changed} files`);
