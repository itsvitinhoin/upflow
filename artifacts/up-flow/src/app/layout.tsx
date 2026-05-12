import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
