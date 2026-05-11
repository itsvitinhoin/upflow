"use client";

import { createContext, useContext } from "react";
import type { AppUser } from "@/lib/types";

const UserContext = createContext<AppUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useAppUser(): AppUser | null {
  return useContext(UserContext);
}
