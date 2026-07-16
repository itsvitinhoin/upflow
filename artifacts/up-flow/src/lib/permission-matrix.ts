export type PermissionRole = "owner" | "admin" | "member" | "guest";
export type PermissionLevel = "manage" | "view" | "none" | "owner_only";

export const permissionRoles: Array<{
  id: PermissionRole;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    id: "owner",
    labelKey: "permissions.role.owner",
    descriptionKey: "permissions.role.ownerDescription",
  },
  {
    id: "admin",
    labelKey: "permissions.role.admin",
    descriptionKey: "permissions.role.adminDescription",
  },
  {
    id: "member",
    labelKey: "permissions.role.member",
    descriptionKey: "permissions.role.memberDescription",
  },
  {
    id: "guest",
    labelKey: "permissions.role.guest",
    descriptionKey: "permissions.role.guestDescription",
  },
];

export const permissionLevelLabelKeys: Record<PermissionLevel, string> = {
  manage: "permissions.level.manage",
  view: "permissions.level.view",
  none: "permissions.level.none",
  owner_only: "permissions.level.ownerOnly",
};

export const permissionMatrixSections: Array<{
  titleKey: string;
  descriptionKey: string;
  capabilities: Array<{
    labelKey: string;
    detailKey: string;
    levels: Record<PermissionRole, PermissionLevel>;
  }>;
}> = [
  {
    titleKey: "permissions.section.workspaceAdministration",
    descriptionKey: "permissions.section.workspaceAdministrationDescription",
    capabilities: [
      {
        labelKey: "permissions.capability.viewWorkspaceContent",
        detailKey: "permissions.capability.viewWorkspaceContentDescription",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        labelKey: "permissions.capability.manageMembers",
        detailKey: "permissions.capability.manageMembersDescription",
        levels: { owner: "manage", admin: "manage", member: "none", guest: "none" },
      },
      {
        labelKey: "permissions.capability.deleteWorkspace",
        detailKey: "permissions.capability.deleteWorkspaceDescription",
        levels: { owner: "owner_only", admin: "none", member: "none", guest: "none" },
      },
    ],
  },
  {
    titleKey: "permissions.section.operationalRecords",
    descriptionKey: "permissions.section.operationalRecordsDescription",
    capabilities: [
      {
        labelKey: "permissions.capability.spacesFoldersLists",
        detailKey: "permissions.capability.spacesFoldersListsDescription",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        labelKey: "permissions.capability.projectsTasksDocs",
        detailKey: "permissions.capability.projectsTasksDocsDescription",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        labelKey: "permissions.capability.clientsContactsNotes",
        detailKey: "permissions.capability.clientsContactsNotesDescription",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        labelKey: "permissions.capability.calendarTime",
        detailKey: "permissions.capability.calendarTimeDescription",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
    ],
  },
  {
    titleKey: "permissions.section.workflowSystems",
    descriptionKey: "permissions.section.workflowSystemsDescription",
    capabilities: [
      {
        labelKey: "permissions.capability.templatesPlaybooks",
        detailKey: "permissions.capability.templatesPlaybooksDescription",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        labelKey: "permissions.capability.automationsGoals",
        detailKey: "permissions.capability.automationsGoalsDescription",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
      {
        labelKey: "permissions.capability.settingsHealth",
        detailKey: "permissions.capability.settingsHealthDescription",
        levels: { owner: "manage", admin: "manage", member: "view", guest: "view" },
      },
    ],
  },
];
