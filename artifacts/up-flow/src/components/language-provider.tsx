"use client";

import * as React from "react";

export type Language = "en" | "pt-BR";

type TranslationVars = Record<string, string | number>;

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, vars?: TranslationVars) => string;
}

const STORAGE_KEY = "upflow.language";

const translations: Record<Language, Record<string, string>> = {
  en: {
    "language.english": "English",
    "language.portugueseBrazil": "Portuguese (Brazil)",
    "language.shortEnglish": "EN",
    "language.shortPortuguese": "PT-BR",
    "language.toggle": "Change language",
    "header.searchPlaceholder": "Search {title}, projects, tasks, docs...",
    "header.notifications": "Notifications",
    "header.markAllRead": "Mark all read",
    "header.allCaughtUp": "You're all caught up",
    "header.newProject": "New Project",
    "nav.dashboard": "Dashboard",
    "nav.team": "Team",
    "nav.timeTracking": "Time tracking",
    "nav.inbox": "Inbox",
    "nav.calendar": "Calendar",
    "nav.projects": "Projects",
    "nav.clients": "Clients",
    "sidebar.show": "Show sidebar",
    "sidebar.hide": "Hide sidebar",
    "sidebar.help": "Help",
    "sidebar.signOut": "Sign out",
    "sidebar.navigation": "Navigation",
    "sidebar.workspace": "Workspace",
    "sidebar.spaces": "Spaces",
    "sidebar.collapseAll": "Collapse all",
    "sidebar.newSpace": "New space",
    "sidebar.searchSpaces": "Search spaces...",
    "sidebar.clearSearch": "Clear sidebar search",
    "sidebar.loading": "Loading...",
    "sidebar.noSearchMatches": "No spaces, folders, or lists match {query}.",
    "sidebar.noSpaces": "No spaces yet.",
    "sidebar.createFirstSpace": "Create your first space",
    "workspace.loading": "Loading workspace...",
    "workspace.namePrompt": "Workspace name",
    "workspace.switchError": "Could not switch workspace",
    "workspace.createError": "Could not create workspace",
    "workspace.new": "New workspace",
    "auth.signedOut": "Signed out",
    "auth.signOutFailed": "Sign-out failed; please try again",
  },
  "pt-BR": {
    "language.english": "Ingles",
    "language.portugueseBrazil": "Portugues (Brasil)",
    "language.shortEnglish": "EN",
    "language.shortPortuguese": "PT-BR",
    "language.toggle": "Alterar idioma",
    "header.searchPlaceholder": "Buscar {title}, projetos, tarefas, docs...",
    "header.notifications": "Notificacoes",
    "header.markAllRead": "Marcar tudo como lido",
    "header.allCaughtUp": "Tudo em dia",
    "header.newProject": "Novo projeto",
    "nav.dashboard": "Dashboard",
    "nav.team": "Equipe",
    "nav.timeTracking": "Controle de tempo",
    "nav.inbox": "Caixa de entrada",
    "nav.calendar": "Calendario",
    "nav.projects": "Projetos",
    "nav.clients": "Clientes",
    "sidebar.show": "Mostrar sidebar",
    "sidebar.hide": "Ocultar sidebar",
    "sidebar.help": "Ajuda",
    "sidebar.signOut": "Sair",
    "sidebar.navigation": "Navegacao",
    "sidebar.workspace": "Workspace",
    "sidebar.spaces": "Espacos",
    "sidebar.collapseAll": "Recolher tudo",
    "sidebar.newSpace": "Novo espaco",
    "sidebar.searchSpaces": "Buscar espacos...",
    "sidebar.clearSearch": "Limpar busca da sidebar",
    "sidebar.loading": "Carregando...",
    "sidebar.noSearchMatches": "Nenhum espaco, pasta ou lista corresponde a {query}.",
    "sidebar.noSpaces": "Nenhum espaco ainda.",
    "sidebar.createFirstSpace": "Criar primeiro espaco",
    "workspace.loading": "Carregando workspace...",
    "workspace.namePrompt": "Nome do workspace",
    "workspace.switchError": "Nao foi possivel trocar de workspace",
    "workspace.createError": "Nao foi possivel criar workspace",
    "workspace.new": "Novo workspace",
    "auth.signedOut": "Sessao encerrada",
    "auth.signOutFailed": "Falha ao sair; tente novamente",
  },
};

const LanguageContext = React.createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => null,
  toggleLanguage: () => null,
  t: (key) => key,
});

function normalizeLanguage(value: string | null): Language | null {
  if (value === "en" || value === "pt-BR") return value;
  return null;
}

function interpolate(value: string, vars?: TranslationVars) {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`,
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>("en");

  React.useEffect(() => {
    try {
      const stored = normalizeLanguage(localStorage.getItem(STORAGE_KEY));
      if (stored) setLanguageState(stored);
    } catch {
      // localStorage can be unavailable in privacy modes; English stays as default.
    }
  }, []);

  const setLanguage = React.useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-persistent language selection is still usable for the current session.
    }
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
  }, [language]);

  const value = React.useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "en" ? "pt-BR" : "en"),
      t: (key, vars) => {
        const localized = translations[language][key] ?? translations.en[key] ?? key;
        return interpolate(localized, vars);
      },
    }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return React.useContext(LanguageContext);
}
