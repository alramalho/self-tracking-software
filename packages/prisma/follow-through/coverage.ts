// "What did you cover?" on learning plans, shared by the server and both apps.
// The owner's rules (18 Nov 2026): learning plans only (not running or the gym, whose watch already says
// what was done), at most one ask a week per plan, never while anything else waits on the Coach tab,
// and two skips in a row keep it quiet for two weeks. Answering is the Share more voice note.
import { addDaysToDateKey, getPlanWeekDateKey, getPlanWeekStartKey } from "../plan-week";

/** Plan categories that follow a curriculum: a course, a book, lessons. */
export const LEARNING_CATEGORIES = ["language_learning", "music", "coding", "writing", "reading", "art"] as const;

export const isLearningPlan = (plan: { category?: string | null }) =>
  !!plan.category && (LEARNING_CATEGORIES as readonly string[]).includes(plan.category);

/** Per plan, in FollowThroughState.coverage. */
export interface CoverageState {
  /** Last "What did you cover?" answer (a Share more note on this plan). */
  answeredAt?: string;
  /** Last "Not now" on the Coach tab's question. */
  skippedAt?: string;
  /** "Not now" in a row; two of them start a quiet spell. */
  skips: number;
  /** No ask through this local day (yyyy-MM-dd). */
  quietUntil?: string;
  /** The coach's read of the last answer, for its context. */
  last?: { date: string; pace: CoveragePace; covered: string };
}

export type CoveragePace = "ON_TRACK" | "AHEAD" | "BEHIND" | "UNCLEAR";

export const COVERAGE_MAX_SKIPS = 2;
export const COVERAGE_QUIET_DAYS = 14;

type DateValue = Date | string;
const dayKey = (value: DateValue) => getPlanWeekDateKey(value);
const sameWeek = (a: DateValue, b: DateValue) => getPlanWeekStartKey(new Date(a)) === getPlanWeekStartKey(new Date(b));

export interface CoverageEntry {
  id?: string;
  activityId?: string | null;
  datetime: DateValue;
  quantity?: number;
  description?: string | null;
  deletedAt?: DateValue | null;
}

/**
 * The session to ask about, or null. Only a log from today or yesterday that has no note yet, and only
 * once a week: an answer or a skip this week closes it.
 */
export function coverageAsk<E extends CoverageEntry>(input: {
  plan: { id: string; category?: string | null; activities: { id: string }[] };
  entries: E[];
  coverage?: CoverageState;
  now?: Date;
}): E | null {
  const { plan, coverage, now = new Date() } = input;
  if (!isLearningPlan(plan)) return null;
  const today = dayKey(now);
  if (coverage?.quietUntil && coverage.quietUntil >= today) return null;
  if (coverage?.answeredAt && sameWeek(coverage.answeredAt, now)) return null;
  if (coverage?.skippedAt && sameWeek(coverage.skippedAt, now)) return null;
  const yesterday = addDaysToDateKey(today, -1);
  const latest = input.entries
    .filter((e) => !e.deletedAt && plan.activities.some((a) => a.id === e.activityId))
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];
  if (!latest || dayKey(latest.datetime) < yesterday || dayKey(latest.datetime) > today) return null;
  if (latest.description?.trim()) return null;
  return latest;
}

/** "Not now": counts toward the quiet spell. */
export function skipCoverage(current: CoverageState | undefined, now = new Date()): CoverageState {
  const skips = (current?.skips ?? 0) + 1;
  return skips >= COVERAGE_MAX_SKIPS
    ? { ...current, skippedAt: now.toISOString(), skips: 0, quietUntil: addDaysToDateKey(dayKey(now), COVERAGE_QUIET_DAYS) }
    : { ...current, skippedAt: now.toISOString(), skips };
}

/** An answer resets the skips. */
export const answerCoverage = (current: CoverageState | undefined, now = new Date()): CoverageState => ({
  ...current,
  answeredAt: now.toISOString(),
  skips: 0,
});
