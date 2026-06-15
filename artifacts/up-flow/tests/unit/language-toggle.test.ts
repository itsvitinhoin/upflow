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

test("dashboard and project task surfaces use translation keys", () => {
  const provider = read("src/components/language-provider.tsx");
  const dashboard = read("src/app/(dashboard)/page.tsx");
  const projectPage = read("src/app/(dashboard)/projects/[id]/page.tsx");
  const toolbar = read("src/components/projects/project-toolbar.tsx");
  const taskDialog = read("src/components/projects/new-task-dialog.tsx");
  const taskPanel = read("src/components/projects/create-task-panel.tsx");
  const taskTemplates = read("src/components/projects/task-template-fields.tsx");

  assert.match(provider, /"dashboard\.commandCenter": "Centro de Operacoes da Agencia"/);
  assert.match(provider, /"toolbar\.board": "Quadro"/);
  assert.match(provider, /"task\.createTask": "Criar entrega"/);
  assert.match(provider, /"taskTemplate\.creative\.label": "Criativo \/ Design"/);
  assert.match(provider, /"taskTemplate\.technical_support\.label": "Suporte tecnico"/);
  assert.match(dashboard, /t\("dashboard\.commandCenter"\)/);
  assert.match(dashboard, /t\("dashboard\.todayFocus"\)/);
  assert.match(projectPage, /t\("projects\.addTask"\)/);
  assert.match(toolbar, /t\("toolbar\.board"\)/);
  assert.match(toolbar, /t\("toolbar\.searchTasks"\)/);
  assert.match(taskDialog, /t\("task\.createTask"\)/);
  assert.match(taskPanel, /t\("task\.boardCoverImage"\)/);
  assert.match(taskTemplates, /t\("taskTemplate\.type"\)/);
});

test("core rollout surfaces are wired to the language provider", () => {
  const provider = read("src/components/language-provider.tsx");
  const dashboard = read("src/app/(dashboard)/page.tsx");
  const calendar = read("src/app/(dashboard)/calendar/page.tsx");
  const clients = read("src/app/(dashboard)/clients/page.tsx");
  const team = read("src/app/(dashboard)/team/page.tsx");
  const time = read("src/app/(dashboard)/time/page.tsx");
  const inviteDialog = read("src/components/dashboard/invite-dialog.tsx");
  const teamInvitePanels = read("src/components/team/team-invite-panels.tsx");
  const scheduleDialog = read("src/components/dashboard/schedule-meeting-dialog.tsx");
  const errorPage = read("src/app/error.tsx");
  const notFoundPage = read("src/app/not-found.tsx");

  assert.match(provider, /"calendar\.manage": "Gerenciar"/);
  assert.match(provider, /"clients\.assignedTeam": "Equipe atribuida"/);
  assert.match(provider, /"team\.membersTitle": "Membros da equipe"/);
  assert.match(provider, /"time\.weeklyHours": "Horas da semana"/);
  assert.match(provider, /"invite\.mode": "Modo do convite"/);
  assert.match(provider, /"error\.pageTitle": "Esta pagina nao carregou"/);

  assert.match(dashboard, /t\("dashboard\.noTrackedTime"\)/);
  assert.match(dashboard, /t\("dashboard\.todayMeetings"\)/);
  assert.match(dashboard, /t\("dashboard\.lastActions"\)/);
  assert.match(calendar, /useLanguage/);
  assert.match(calendar, /t\("calendar\.newEvent"\)/);
  assert.match(calendar, /Intl\.DateTimeFormat\(language/);
  assert.match(clients, /t\("clients\.planNotSet"\)/);
  assert.match(clients, /t\("clients\.assignedTeam"\)/);
  assert.match(team, /t\("team\.membersTitle"\)/);
  assert.match(team, /t\("team\.searchMembers"\)/);
  assert.match(time, /t\("time\.title"\)/);
  assert.match(time, /t\("time\.weeklyHours"\)/);
  assert.match(inviteDialog, /t\("invite\.mode"\)/);
  assert.match(inviteDialog, /inviteErrorHint\(error\.code, t\)/);
  assert.match(teamInvitePanels, /t\("invite\.realUsersTitle"\)/);
  assert.match(scheduleDialog, /t\("calendar\.scheduleMeeting"\)/);
  assert.match(errorPage, /t\("error\.pageTitle"\)/);
  assert.match(notFoundPage, /t\("error\.notFoundTitle"\)/);
});
