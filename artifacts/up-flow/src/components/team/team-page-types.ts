import type { Department, TeamMember } from "@/lib/types";

export interface PendingInvite {
  id: string;
  email: string;
  role: "admin" | "member" | "guest";
  expires_at?: string;
  expired?: boolean;
  tester_invite?: boolean;
  invite_mode?: "personal_workspace" | "workspace_access";
  send_status?: "pending" | "sent" | "failed";
  send_error?: string | null;
  last_sent_at?: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  created_at: string;
  workspace?: { id: string; name: string; slug: string };
  inviter: { id: string; name: string; email: string } | null;
}

export interface EmailStatus {
  app_url_configured: boolean;
  resend_api_key_configured: boolean;
  email_from_configured: boolean;
  using_development_sender: boolean;
  ready: boolean;
}

export interface TeamOverview {
  workspace: { id: string; name: string; slug: string } | null;
  current_role: "owner" | "admin" | "member" | "guest" | null;
  is_super_admin: boolean;
  members: TeamMember[];
  departments: Department[];
}

export interface TesterWorkspace {
  id: string;
  name: string;
  slug: string;
}

export const UNASSIGNED_KEY = "__unassigned__";
export const COLLAPSE_STORAGE_KEY = "upflow:team:collapsedDepartments";
