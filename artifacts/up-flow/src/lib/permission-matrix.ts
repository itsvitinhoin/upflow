export type PermissionRole = "owner" | "admin" | "member" | "guest";
export type PermissionLevel = "manage" | "view" | "none" | "owner_only";

export const permissionRoles: Array<{
  id: PermissionRole;
  label: string;
  description: string;
}> = [
  {
    id: "owner",
    label: "Owner",
    description: "Full workspace control, billing-level ownership, and destructive workspace actions.",
  },
  {
    id: "admin",
    label: "Admin",
    description: "Can create, edit, delete, invite, configure, and run workspace operations.",
  },
  {
    id: "member",
    label: "Member",
    description: "Read-only workspace visibility for internal teammates without mutation access.",
  },
  {
    id: "guest",
    label: "Guest",
    description: "Read-only workspace visibility for external or limited-access collaborators.",
  },
];

export const permissionLevelLabels: Record<PermissionLevel, string> = {
  manage: "Manage",
  view: "View only",
  none: "No access",
  owner_only: "Owner only",
};

export const permissionMatrixSections: Array<{
  title: string;
  description: string;
  capabilities: Array<{
    label: string;
    detail: string;
    levels: Record<PermissionRole, PermissionLevel>;
  }>;
}> = [
  {
    title: "Workspace administration",
    description: "Controls workspace setup, member access, and destructive account-level actions.",
    capabilities: [
      {
        label: "View workspace content",
        detail: "Open dashboards, clients, projects, spaces, docs, calendar, and activity.",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        label: "Manage members and invites",
        detail: "Invite users, change roles, remove members, and assign departments.",
        levels: { owner: "manage", admin: "manage", member: "none", guest: "none" },
      },
      {
        label: "Delete workspace",
        detail: "Permanently delete the workspace and move the active session to another workspace.",
        levels: { owner: "owner_only", admin: "none", member: "none", guest: "none" },
      },
    ],
  },
  {
    title: "Operational records",
    description: "Controls the records that change agency work, client data, and delivery state.",
    capabilities: [
      {
        label: "Spaces, folders, and lists",
        detail: "Create, rename, move, and delete workspace organization.",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        label: "Projects, tasks, docs, and comments",
        detail: "Create and update delivery work, docs, task status, assignment, and discussions.",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        label: "Clients, contacts, notes, and reports",
        detail: "Maintain client records, plan data, contacts, activity notes, and client reporting.",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        label: "Calendar events and time entries",
        detail: "Schedule meetings, track work time, and edit operational history.",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
    ],
  },
  {
    title: "Workflow systems",
    description: "Controls repeatable processes and internal operating rules.",
    capabilities: [
      {
        label: "Templates and playbooks",
        detail: "Create reusable templates and apply them to generate real project work.",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        label: "Automations and goals",
        detail: "Configure automation rules, operating goals, owners, and progress targets.",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        label: "Settings and health checks",
        detail: "Review production readiness, workspace setup, and permission policies.",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
    ],
  },
];
