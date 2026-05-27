import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

test("app shell exposes an English and Portuguese Brazil language toggle", () => {
  const provider = read("src/components/language-provider.tsx");
  const header = read("src/components/layout/header.tsx");
  const providers = read("src/components/providers.tsx");

  assert.match(provider, /export type Language = "en" \| "pt-BR"/);
  assert.match(provider, /upflow\.language/);
  assert.match(provider, /document\.documentElement\.lang = language/);
  assert.match(provider, /"language\.portugueseBrazil": "Portugues \(Brasil\)"/);
  assert.match(provider, /"header\.newProject": "Novo projeto"/);
  assert.match(header, /Languages/);
  assert.match(header, /toggleLanguage/);
  assert.match(header, /language === "en" \? "EN" : "PT"/);
  assert.match(providers, /<LanguageProvider>/);
});

test("sidebar and workspace chrome use translation keys for shared labels", () => {
  const rail = read("src/components/layout/sidebar/rail.tsx");
  const panel = read("src/components/layout/sidebar/panel.tsx");
  const panelNav = read("src/components/layout/sidebar/panel-nav.tsx");
  const workspaceSwitcher = read("src/components/layout/workspace-switcher.tsx");

  assert.match(rail, /labelKey: "nav\.dashboard"/);
  assert.match(rail, /t\("sidebar\.show"\)/);
  assert.match(panelNav, /t\("sidebar\.navigation"\)/);
  assert.match(panel, /t\("sidebar\.searchSpaces"\)/);
  assert.match(workspaceSwitcher, /t\("workspace\.new"\)/);
});
