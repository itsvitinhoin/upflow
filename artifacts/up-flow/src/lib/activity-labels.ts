type Translate = (key: string, vars?: Record<string, string | number>) => string;

function humanizeIdentifier(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function localizedIdentifier(prefix: "activity.event" | "activity.entity", value: string, t: Translate) {
  const key = `${prefix}.${value}`;
  const translated = t(key);
  return translated === key ? humanizeIdentifier(value) : translated;
}

export function activityEventLabel(type: string, t: Translate) {
  return localizedIdentifier("activity.event", type, t);
}

export function activityEntityLabel(entityType: string, t: Translate) {
  return localizedIdentifier("activity.entity", entityType, t);
}
