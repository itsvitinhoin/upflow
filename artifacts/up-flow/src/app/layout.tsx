import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import Providers from "@/components/providers";

const themeInitializer = `
  (() => {
    const root = document.documentElement;
    let preference = "dark";

    try {
      const stored = localStorage.getItem("upflow.theme");
      if (stored === "light" || stored === "dark" || stored === "system") {
        preference = stored;
      }
    } catch {}

    const resolved = preference === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;

    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  })();
`;

export const metadata: Metadata = {
  title: "Up Flow",
  description: "Internal project management tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          id="upflow-theme-initializer"
          dangerouslySetInnerHTML={{ __html: themeInitializer }}
        />
      </head>
      <body className="upflow-performance bg-background text-foreground" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
