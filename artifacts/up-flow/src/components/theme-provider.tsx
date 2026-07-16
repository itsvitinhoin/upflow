"use client";

import * as React from "react";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = Exclude<Theme, "system">;

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
}

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextType>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => null,
});

const THEME_STORAGE_KEY = "upflow.theme";

function normalizeTheme(value: string | null): Theme | null {
  if (value === "dark" || value === "light" || value === "system") return value;
  return null;
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function fallbackResolvedTheme(theme: Theme): ResolvedTheme {
  return theme === "light" ? "light" : "dark";
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export function ThemeProvider({
  children,
  defaultTheme = "light",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(
    fallbackResolvedTheme(defaultTheme),
  );

  const applyTheme = React.useCallback(
    (preference: Theme) => {
      const resolved = preference === "system" && enableSystem
        ? systemTheme()
        : fallbackResolvedTheme(preference);
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
      root.style.colorScheme = resolved;
      setResolvedTheme(resolved);
    },
    [enableSystem],
  );

  useIsomorphicLayoutEffect(() => {
    let initialTheme = defaultTheme;
    try {
      initialTheme = normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY)) ?? defaultTheme;
    } catch {
      // Ignore storage failures so private browsing or blocked storage does not break rendering.
    }

    if (initialTheme === "system" && !enableSystem) initialTheme = defaultTheme;
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, [applyTheme, defaultTheme, enableSystem]);

  const updateTheme = React.useCallback((nextTheme: Theme) => {
    const supportedTheme = nextTheme === "system" && !enableSystem ? defaultTheme : nextTheme;
    setTheme(supportedTheme);
    applyTheme(supportedTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, supportedTheme);
    } catch {
      // Theme changes should still work for the current session when storage is unavailable.
    }
  }, [applyTheme, defaultTheme, enableSystem]);

  React.useEffect(() => {
    if (theme !== "system" || !enableSystem) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [applyTheme, enableSystem, theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
