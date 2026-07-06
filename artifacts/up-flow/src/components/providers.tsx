"use client";

import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import type { ReactNode } from "react";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster richColors position="top-right" theme={theme === "light" ? "light" : "dark"} />;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <LanguageProvider>
        {children}
        <ThemedToaster />
      </LanguageProvider>
    </ThemeProvider>
  );
}
