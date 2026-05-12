import type { TeamMember } from "@/lib/types";

export type Meeting = {
  time: string;
  title: string;
  with: string;
  color: string;
};

export const todayMeetings: Meeting[] = [
  {
    time: "08:30",
    title: "Daily standup",
    with: "Engineering",
    color: "bg-primary/20 text-primary",
  },
  {
    time: "10:30",
    title: "XR Health review",
    with: "Product",
    color: "bg-upflow-success/20 text-upflow-success",
  },
  {
    time: "14:30",
    title: "Design review",
    with: "Product · Design",
    color: "bg-upflow-warning/20 text-upflow-warning",
  },
  {
    time: "16:00",
    title: "Team meeting",
    with: "Acme Corp",
    color: "bg-upflow-danger/20 text-upflow-danger",
  },
];

/* Per-weekday vertical capsules: each day has a stack of dots, sized by hours.
 * Colors cycle through accent / success / warning / danger so each day looks
 * varied without backend data. */
const dotPalette = [
  "bg-primary",
  "bg-upflow-success",
  "bg-upflow-warning",
  "bg-upflow-danger",
];

export const weekActivity = [
  { day: "Mon", dots: [16, 10, 14, 8, 12] },
  { day: "Tue", dots: [12, 18, 8, 10] },
  { day: "Wed", dots: [10, 20, 14, 8, 12, 6] },
  { day: "Thu", dots: [14, 10, 18, 8] },
  { day: "Fri", dots: [12, 14, 10] },
  { day: "Sat", dots: [8, 10] },
  { day: "Sun", dots: [6] },
].map((d, di) => ({
  ...d,
  items: d.dots.map((size, i) => ({
    size,
    color: dotPalette[(i + di) % dotPalette.length],
  })),
}));

export type RecentAction = {
  who: string;
  what: string;
  target: string;
  when: string;
  status: "completed" | "in_progress";
};

export const recentActions = (currentUserName: string): RecentAction[] => [
  {
    who: "Annette Black",
    what: "talked about",
    target: "us pages",
    when: "11:34am 04/04/23",
    status: "completed",
  },
  {
    who: "Arlene McCoy",
    what: "shipped",
    target: "UI Dashboard",
    when: "11:34am 03/05/23",
    status: "completed",
  },
  {
    who: "Esther Howard",
    what: "uploaded",
    target: "3D Objects for pages",
    when: "02:12pm 02/05/23",
    status: "completed",
  },
  {
    who: "Theresa Webb",
    what: "is finishing",
    target: "UX Research",
    when: "03:34pm 02/05/23",
    status: "in_progress",
  },
  {
    who: currentUserName,
    what: "uploaded",
    target: "Showreel video for home page",
    when: "02:34pm 02/05/23",
    status: "completed",
  },
];

export type TimelineBlock = { start: number; end: number; label: string };
export type TimelineRow = {
  user: TeamMember;
  blocks: TimelineBlock[];
  color: string;
};

const palette = [
  "bg-primary/30 border-l-primary",
  "bg-upflow-success/25 border-l-upflow-success",
  "bg-upflow-warning/25 border-l-upflow-warning",
  "bg-upflow-danger/25 border-l-upflow-danger",
];

export function buildTimelineRows(users: TeamMember[]): TimelineRow[] {
  return users.slice(0, 6).map((u, i) => {
    const seed = (u.id.charCodeAt(0) || 0) + i * 13;
    const blocks: TimelineBlock[] = [
      {
        start: 8 + (seed % 4),
        end: Math.min(8 + (seed % 4) + 1 + (seed % 2), 19),
        label: "Standup",
      },
      {
        start: 12 + ((seed >> 2) % 3),
        end: Math.min(12 + ((seed >> 2) % 3) + 2, 19),
        label: "Focus block",
      },
      {
        start: 16 + ((seed >> 1) % 3),
        end: Math.min(16 + ((seed >> 1) % 3) + 1, 19),
        label: "Review",
      },
    ];
    return { user: u, blocks, color: palette[i % palette.length] };
  });
}
