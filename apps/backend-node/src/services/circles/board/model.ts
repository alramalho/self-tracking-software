import type { CircleRecap, MemberWeek } from "../types";

export interface WeekStats {
  numActiveDaysInTheWeek: number;
  numLeftDaysInTheWeek: number;
  daysCompletedThisWeek: number;
}

export interface PastWeek {
  startDate: Date | string;
  outcome?: "complete" | "held" | "missed";
  doneCount?: number;
  targetCount?: number;
}

export interface MemberHistory {
  // Only proven members (who posted their first photo) count toward streaks and recaps.
  proven?: boolean;
  name: string | null;
  joinedAt: Date;
  weeks: PastWeek[];
}

// Someone is behind when finishing now needs every remaining day or more.
// People who joined mid-week are new: never behind for that week.
export function memberWeek(stats: WeekStats, joinedAt: Date, weekStart: Date): MemberWeek {
  const target = stats.numActiveDaysInTheWeek;
  const done = stats.daysCompletedThisWeek;
  const daysLeft = stats.numLeftDaysInTheWeek;
  const toGo = Math.max(0, target - done);
  const isNew = joinedAt > weekStart;
  return {
    target,
    done,
    daysLeft,
    toGo,
    behind: !isNew && toGo > 0 && daysLeft - toGo <= 0,
    isNew,
  };
}

const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const hit = (week: PastWeek) => week.outcome === "complete" || week.outcome === "held";

// Finished weeks, newest first, with the members who were already in the circle.
function finishedWeeks(members: MemberHistory[]) {
  const keys = new Set<string>();
  for (const m of members) for (const w of m.weeks) if (w.outcome) keys.add(dayKey(w.startDate));
  return [...keys]
    .sort()
    .reverse()
    .map((key) => ({
      key,
      people: members
        .filter((m) => m.joinedAt <= new Date(`${key}T00:00:00Z`))
        .map((m) => ({ member: m, week: m.weeks.find((w) => w.outcome && dayKey(w.startDate) === key) }))
        .filter((p): p is { member: MemberHistory; week: PastWeek } => !!p.week),
    }));
}

// Weeks in a row where everyone who was already in the circle hit their target.
// A one-short "held" week counts, as it does for personal streaks.
export function togetherStreak(members: MemberHistory[]): number {
  let streak = 0;
  for (const week of finishedWeeks(members)) {
    if (week.people.length < 2 || !week.people.every((p) => hit(p.week))) break;
    streak += 1;
  }
  return streak;
}

export function lastWeekRecap(members: MemberHistory[]): CircleRecap | null {
  const [week] = finishedWeeks(members);
  if (!week || week.people.length < 2) return null;
  const top = [...week.people].sort((a, b) => (b.week.doneCount ?? 0) - (a.week.doneCount ?? 0))[0];
  return {
    weekStart: week.key,
    hit: week.people.filter((p) => hit(p.week)).length,
    total: week.people.length,
    topName: top && (top.week.doneCount ?? 0) > 0 ? top.member.name : null,
    topCount: top?.week.doneCount ?? 0,
  };
}
