import type { TeamMember } from "@/lib/types";

export type Meeting = {
  time: string;
  title: string;
  with: string;
  color: string;
};

export const todayMeetings: Meeting[] = [
  {
    time: "09:30",
    title: "Daily standup",
    with: "Engineering",
    color: "bg-primary/20 text-primary",
  },
  {
    time: "11:00",
    title: "Sprint planning",
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
    title: "Client check-in",
    with: "Acme Corp",
    color: "bg-upflow-danger/20 text-upflow-danger",
  },
];

export const activityBubbles = Array.from({ length: 24 }, (_, i) => {
  const v = 0.3 + ((i * 37) % 70) / 100;
  return { size: 10 + v * 22, opacity: 0.25 + v * 0.7 };
});

export const recentActions = (currentUserName: string) => [
  { who: "Maya", what: "completed", target: "Login screen", when: "12m ago" },
  { who: "Eli", what: "commented on", target: "API rate limits", when: "27m ago" },
  { who: currentUserName, what: "moved", target: "Onboarding flow", when: "1h ago" },
  { who: "Tomás", what: "created", target: "Atlas project", when: "2h ago" },
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
