import type { CachedProgress, CachedWeek, YearPlanStats } from "./types";
export function yearBounds(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getUTCFullYear())
    throw new Error("Choose a valid year.");
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
}
export function inYear(value: string | undefined | null, year: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= Date.UTC(year, 0, 1) && time < Date.UTC(year + 1, 0, 1);
}
function completedWithinYear(week: CachedWeek, year: number) {
  if (!week.isCompleted || !week.startDate) return false;
  const start = new Date(week.startDate).getTime();
  const end = start + 7 * 86400000;
  if (start >= Date.UTC(year, 0, 1) && end <= Date.UTC(year + 1, 0, 1)) return true;
  // A boundary week cannot borrow completion from December/January outside the year.
  const entries = (week.completedActivities ?? []).filter(e => !e.deletedAt && inYear(e.datetime, year));
  const target = week.plannedActivities;
  if (typeof target === "number") return target > 0 && new Set(entries.map(e => e.datetime.slice(0, 10))).size >= target;
  if (!Array.isArray(target) || !target.length) return false;
  return target.every(session => inYear(session.date, year) && entries.some(e => e.activityId === session.activityId && e.datetime.slice(0, 10) === session.date.slice(0, 10)));
}
export function yearPlanStats(id: string, raw: unknown, year: number): YearPlanStats {
  const progress = (raw && typeof raw === "object" ? raw : {}) as CachedProgress;
  let streak = 0, peakStreak = 0, missed = 0;
  const weeks = [...(Array.isArray(progress.weeks) ? progress.weeks : [])]
    .filter(w => w.startDate && new Date(w.startDate).getTime() < Date.UTC(year + 1, 0, 1) && new Date(w.startDate).getTime() + 7 * 86400000 > Date.UTC(year, 0, 1))
    .sort((a, b) => +new Date(a.startDate!) - +new Date(b.startDate!));
  for (const week of weeks) {
    if (completedWithinYear(week, year)) { streak++; missed = 0; }
    else if (++missed > 1) streak = Math.max(0, streak - 1);
    peakStreak = Math.max(peakStreak, streak);
  }
  return { id, peakStreak, habitEarned: inYear(progress.habitAchievement?.achievedAt, year), lifestyleEarned: inYear(progress.lifestyleAchievement?.achievedAt, year) };
}
