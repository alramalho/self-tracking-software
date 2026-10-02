import type { StreakMilestoneRecord } from "./types";

// Weekly streaks. 4 and 9 match the default Habit and Lifestyle targets.
export const STREAK_MILESTONE_WEEKS = [1, 2, 4, 9, 12, 26, 52];

const highestMilestone = (streak: number) =>
  STREAK_MILESTONE_WEEKS.filter((weeks) => weeks <= streak).at(-1) ?? 0;

/**
 * Milestones newly reached since the last report. A plan seen for the first time
 * only records its baseline, so existing streaks are not reported as new.
 */
export function newStreakMilestones(
  reported: StreakMilestoneRecord,
  streaks: { planId: string; streak: number }[],
) {
  const next: StreakMilestoneRecord = { ...reported };
  const reached: { planId: string; weeks: number }[] = [];
  for (const { planId, streak } of streaks) {
    const highest = highestMilestone(streak);
    const previous = reported[planId];
    if (previous !== undefined)
      for (const weeks of STREAK_MILESTONE_WEEKS)
        if (weeks > previous && weeks <= highest) reached.push({ planId, weeks });
    // A broken streak lowers the baseline so rebuilding it counts again.
    next[planId] = highest;
  }
  return { next, reached };
}
