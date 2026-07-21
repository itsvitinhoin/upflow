const UUID_SOURCE =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const LEGACY_MENTION_RE = new RegExp(
  `@\\[([^\\]]+)\\]\\((${UUID_SOURCE})\\)`,
  "g",
);
const UUID_RE = new RegExp(`^${UUID_SOURCE}$`);

export interface LegacyCommentMentions {
  userIds: Set<string>;
  emails: Set<string>;
}

/**
 * Read the formats written by older clients. New clients send the recipient
 * IDs separately so the UUID transport value never needs to be shown to a
 * person writing a comment.
 */
export function extractLegacyCommentMentions(
  body: string,
): LegacyCommentMentions {
  const userIds = new Set<string>();
  const emails = new Set<string>();
  const emailRe = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

  for (const match of body.matchAll(LEGACY_MENTION_RE)) userIds.add(match[2]);
  for (const match of body.matchAll(emailRe))
    emails.add(match[1].toLowerCase());

  return { userIds, emails };
}

/** Convert legacy mention markup to the text people expect to read. */
export function normalizeCommentBody(body: string) {
  return body.replace(LEGACY_MENTION_RE, "@$1");
}

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

/** Build the visible text added by the teammate picker. */
export function appendVisibleMention(body: string, name: string) {
  return `${body}${body.trim() ? " " : ""}@${name} `;
}

/**
 * A picker-supplied ID is honored only while its visible @Name remains in
 * the submitted text. This prevents a deleted mention from still notifying
 * someone and avoids substring matches such as @Ann matching @Anna.
 */
export function hasVisibleMention(body: string, name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) return false;
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentionRe = new RegExp(
    `(^|\\s)@${escapedName}(?=$|[\\s.,!?;:()[\\]{}])`,
    "i",
  );
  return mentionRe.test(body);
}
