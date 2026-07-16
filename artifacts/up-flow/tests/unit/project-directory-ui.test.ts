import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

test("project index renders the categorized directory instead of a flat card grid", () => {
  const page = read("src/app/(dashboard)/projects/page.tsx");
  const directory = read("src/components/projects/project-directory.tsx");

  assert.match(page, /<ProjectDirectory \/>/);
  assert.match(directory, /"clients",\s*"internal",\s*"operations",\s*"archived"/);
  assert.match(directory, /role="tablist"/);
  assert.match(directory, /type: "client"/);
  assert.match(directory, /expandedClients/);
  assert.match(directory, /data-project-id/);
  assert.doesNotMatch(page, /grid-cols-3/);
});

test("directory state is searchable, shareable, persistent, and paginated", () => {
  const directory = read("src/components/projects/project-directory.tsx");

  assert.match(directory, /useSearchParams/);
  assert.match(directory, /router\.replace/);
  assert.match(directory, /upflow\.projects\.view:/);
  assert.match(directory, /\/api\/projects\/directory/);
  assert.match(directory, /nextCursor/);
  assert.match(directory, /projects\.searchPlaceholder/);
  assert.match(directory, /projects\.clearFilters/);
  assert.match(directory, /focus-visible:ring-2/);
  assert.match(directory, /directoryRequestId/);
  assert.match(directory, /urlParamsRef/);
  assert.match(directory, /pendingQueryRef/);
  assert.match(directory, /setData\(null\)/);
  assert.match(directory, /!loading && data\?\.nextCursor/);
});

test("directory translations cover English and Portuguese category labels", () => {
  const translations = read("src/lib/i18n/translations.ts");

  assert.match(translations, /"projects\.tab\.clients": "Clients"/);
  assert.match(translations, /"projects\.tab\.operations": "Operational queues"/);
  assert.match(translations, /"projects\.tab\.clients": "Clientes"/);
  assert.match(translations, /"projects\.tab\.operations": "Filas operacionais"/);
  assert.match(translations, /"sidebar\.searchSpacesAndProjects": "Encontrar espaços e projetos\.\.\."/);
});
