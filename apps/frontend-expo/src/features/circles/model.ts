import type { BoardMember, MyCircle, PastWeeks, WeekBar, WeekChip } from "./types";

// Matching keeps adding people with a similar goal until a circle has this many.
export const MATCHING_TARGET = 5;

// One colour per person in the past-weeks chart, by their order on the board.
const PERSON_COLORS = ["#e0527d", "#d97706", "#7c5cff", "#3b82f6", "#0f9f6e", "#0891b2", "#be4bdb", "#64748b"];

export function personColors(members: BoardMember[]): Record<string, string> {
  return Object.fromEntries(members.map((m, i) => [m.user.id, PERSON_COLORS[i % PERSON_COLORS.length]]));
}

// The chip on a circle log. `done` marks the session that completes the week (or goes past it).
export function weekChipLabel(chip: WeekChip): { text: string; done: boolean } {
  if (chip.done < chip.target) return { text: `${chip.done} of ${chip.target} this week`, done: false };
  if (chip.done === chip.target) return { text: `Week done ✅ ${chip.done} of ${chip.target}`, done: true };
  return { text: `Week done ✅ +${chip.done - chip.target}`, done: true };
}

// Under "Past weeks" on the circle page: the streak together, and where you stand.
export function pastWeeksLine(streak: number, percent: number | undefined): string {
  const parts = [
    streak > 0 ? `${streak} 🔥 ${streak === 1 ? "week" : "weeks"} together` : "",
    percent === undefined ? "" : `you're at ${percent}%`,
  ].filter(Boolean);
  return parts.join(" · ") || "See how the circle is doing";
}

// The chart's bars: each finished week, then the week in progress. Slices follow the board's order.
export function weekBars(past: PastWeeks, members: BoardMember[]): WeekBar[] {
  const order = members.filter((m) => !m.pending).map((m) => m.user.id);
  const finished = past.weeks.map((week) => ({
    key: week.start,
    label: String(Number(week.start.slice(8, 10))),
    current: false,
    allHit: week.allHit,
    target: week.people.reduce((sum, p) => sum + p.target, 0),
    segments: order.flatMap((userId) => {
      const person = week.people.find((p) => p.userId === userId);
      return person ? [{ userId, done: person.done }] : [];
    }),
  }));
  const now = members.filter((m) => !m.pending);
  return [
    ...finished,
    {
      key: "now",
      label: "Now",
      current: true,
      allHit: false,
      target: now.reduce((sum, m) => sum + m.week.target, 0),
      segments: now.map((m) => ({ userId: m.user.id, done: m.week.done })),
    },
  ];
}

// Home square line: "4 of 5 on track · 2 days left", or how far a forming circle is.
export function circleStatusLine(circle: MyCircle): string {
  if (circle.pending) return "Post a photo to join";
  if (circle.status === "FORMING") return `Forming · ${circle.memberCount} of 2`;
  const days = circle.daysLeft === 1 ? "1 day left" : `${circle.daysLeft} days left`;
  return `${circle.onTrack} of ${circle.memberCount} on track · ${days}`;
}
