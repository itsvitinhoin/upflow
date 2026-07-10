import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import Providers from "@/components/providers";

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
      <body className="upflow-performance bg-background text-foreground" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
