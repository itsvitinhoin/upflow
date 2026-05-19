// Department color palette. Keep in sync with the VALID_COLORS set on the
// API side (src/app/api/workspaces/[id]/departments/route.ts).

export const DEPARTMENT_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
] as const;

export type DepartmentColor = (typeof DEPARTMENT_COLORS)[number];

// Server-side validation also imports this — keep the palette as a single
// source of truth so the client picker and the API stay in sync.
export const DEPARTMENT_COLOR_SET: ReadonlySet<string> = new Set(
  DEPARTMENT_COLORS,
);

export function isValidDepartmentColor(c: unknown): c is DepartmentColor {
  return typeof c === "string" && DEPARTMENT_COLOR_SET.has(c);
}

// Tailwind classes for the small color dot rendered next to each group
// header. Mapped explicitly so Tailwind's JIT picks them up at build time.
const DOT_CLASS: Record<string, string> = {
  slate: "bg-slate-400",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
};

export function colorDotClass(color: string | null | undefined): string {
  if (!color) return DOT_CLASS.slate;
  return DOT_CLASS[color] ?? DOT_CLASS.slate;
}
