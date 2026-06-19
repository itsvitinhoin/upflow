import type { MemberJoinedData, Notification } from "@/lib/types";

type LanguageCode = "en" | "pt" | "pt-BR";

function isPortuguese(language: LanguageCode) {
  return language === "pt" || language === "pt-BR";
}

function memberJoinedData(notification: Notification): MemberJoinedData {
  return notification.data && typeof notification.data === "object"
    ? (notification.data as MemberJoinedData)
    : {};
}

export function formatMemberRole(role: MemberJoinedData["role"], language: LanguageCode = "en") {
  if (role === "admin") return isPortuguese(language) ? "Administrador" : "Admin";
  return isPortuguese(language) ? "Membro" : "Member";
}

export function memberJoinedNotificationLabel(
  notification: Notification,
  language: LanguageCode = "en",
) {
  const data = memberJoinedData(notification);
  const who =
    data.new_member_name ||
    data.new_member_email ||
    (isPortuguese(language) ? "Uma pessoa" : "Someone");
  const workspaceName =
    notification.workspace?.name ?? (isPortuguese(language) ? "este workspace" : "this workspace");
  const roleLabel = formatMemberRole(data.role, language);

  if (isPortuguese(language)) {
    return `${who} entrou no workspace ${workspaceName} como ${roleLabel}`;
  }

  return `${who} joined workspace ${workspaceName} as ${roleLabel}`;
}
