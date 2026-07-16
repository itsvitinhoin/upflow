"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary that catches errors thrown by `app/layout.tsx`
 * itself. Must render its own <html>/<body> because the root layout did
 * not get to mount.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isPortuguese, setIsPortuguese] = useState(false);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  useEffect(() => {
    try {
      setIsPortuguese(
        window.localStorage.getItem("upflow.language") === "pt-BR" ||
          document.documentElement.lang === "pt-BR",
      );
    } catch {
      setIsPortuguese(document.documentElement.lang === "pt-BR");
    }
  }, []);

  const copy = isPortuguese
    ? {
        title: "O Up Flow está temporariamente indisponível",
        description: "Encontramos um erro crítico ao carregar o aplicativo. Nossa equipe foi avisada. Atualize a página em instantes.",
        reload: "Recarregar",
      }
    : {
        title: "Up Flow is temporarily unavailable",
        description: "We hit a critical error loading the app. Our team has been notified. Please refresh in a moment.",
        reload: "Reload",
      };

  return (
    <html lang={isPortuguese ? "pt-BR" : "en"}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#16171c",
          color: "#e6e8ee",
        }}
      >
        <div style={{ maxWidth: 480, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>
            {copy.title}
          </h1>
          <p style={{ color: "#9aa0ad", margin: "0 0 24px", fontSize: 14 }}>
            {copy.description}
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "8px 16px",
              borderRadius: 6,
              background: "#6f5cff",
              color: "white",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {copy.reload}
          </a>
        </div>
      </body>
    </html>
  );
}
