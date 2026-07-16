"use client";

import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import type { ReactNode } from "react";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster richColors position="top-right" theme={resolvedTheme} />;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" enableSystem>
      <LanguageProvider>
        {children}
        <ThemedToaster />
      </LanguageProvider>
    </ThemeProvider>
  );
}
