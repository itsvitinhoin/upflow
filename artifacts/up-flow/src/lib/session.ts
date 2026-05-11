import type { Session } from "next-auth";

export interface AppUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "admin" | "member";
}

export function getUserId(session: Session): string {
  return (session.user as AppUser).id;
}

export function getAppUser(session: Session): AppUser {
  return session.user as AppUser;
}
