"use client";

import { createContext, useContext, useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import type { AppUser } from "@/lib/types";

const UserContext = createContext<AppUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  // Hydrate the client-side Sentry scope with the signed-in user's id so
  // browser uncaught errors and `Sentry.captureException` calls from our
  // error boundaries (app/error.tsx, app/(dashboard)/error.tsx,
  // app/global-error.tsx) automatically carry user context. We deliberately
  // do NOT send email or any other PII — only the opaque id.
  useEffect(() => {
    try {
      Sentry.getCurrentScope().setUser({ id: user.id });
      Sentry.getCurrentScope().setTag("role", user.role ?? "unknown");
    } catch {
      // SDK may be unconfigured in dev; ignore.
    }
    return () => {
      try {
        Sentry.getCurrentScope().setUser(null);
      } catch {
        // ignore
      }
    };
  }, [user.id, user.role]);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useAppUser(): AppUser | null {
  return useContext(UserContext);
}
