/**
 * How the weekly streak works. This is the one place the rule lives: the server scores
 * plans with it, the app explains a missed week with it, and the coach and the badge
 * explainer read the same sentences. Change the rule here and nowhere else.
 */
export type WeekOutcome = "complete" | "held" | "missed";

/** A week one session short still holds the streak when the weekly target is at least this. */
export const HOLD_MIN_TARGET = 3;
export const HABIT_WEEKS = 4;
export const LIFESTYLE_WEEKS = 9;

/** The rule in plain words, for the badge explainer and the coach's instructions. */
export const STREAK_RULES = [
  "Each completed week adds +1 to the streak",
  "Each missed week subtracts -1 from the streak, starting with the first",
  `One session short (${HOLD_MIN_TARGET}+ per week): the streak holds, but not two weeks in a row`,
  "The streak cannot go below 0",
];

/** What the coach is told on top of the rules above. */
export const STREAK_RULES_FOR_COACH = [
  ...STREAK_RULES,
  "A missed week never resets the streak to 0 in one go, and a second one-short week right after a held one counts as missed",
  "The week in progress only counts once it is complete",
  `${HABIT_WEEKS} weeks of streak earn the Habit badge, ${LIFESTYLE_WEEKS} the Lifestyle badge`,
];

export type FinishedWeek = { completed: boolean; done: number; target: number };

export const isOneShort = (week: FinishedWeek) =>
  !week.completed && week.target >= HOLD_MIN_TARGET && week.done === week.target - 1;

/** How a finished week counts. `previous` is the outcome of the week before it. */
export function weekOutcome(week: FinishedWeek, previous?: WeekOutcome): WeekOutcome {
  if (week.completed) return "complete";
  return isOneShort(week) && previous !== "held" ? "held" : "missed";
}

export function streakAfter(streak: number, outcome: WeekOutcome): number {
  if (outcome === "complete") return streak + 1;
  return outcome === "held" ? streak : Math.max(0, streak - 1);
}

/** What last week's miss cost, kept on the plan's progress all this week. */
export type MissedWeek = {
  streakBefore: number;
  streakAfter: number;
  /** Missed weeks in a row, this one included. */
  inARow: number;
  /** Sessions done and the target that week, as the server counted them. */
  done?: number;
  target?: number;
  /** One short, which would have held the streak, but the week before was already held. */
  oneShortAgain?: boolean;
};

/** One line on why the week was missed, in the app's words. */
export function missedWeekReason(missed: MissedWeek): string {
  if (missed.oneShortAgain)
    return "one session short for the second week in a row, so the streak could not hold again";
  if (missed.done !== undefined && missed.target !== undefined)
    return `${missed.done} of ${missed.target} sessions done`;
  return "the weekly target was not reached";
}

/** A plan's streak as the coach should read it. */
export function describeStreak(achievement?: {
  streak: number;
  missedLastWeek?: MissedWeek | null;
} | null): string {
  if (!achievement) return "";
  const streak = `${achievement.streak} ${achievement.streak === 1 ? "week" : "weeks"}`;
  const missed = achievement.missedLastWeek;
  if (!missed) return streak;
  return `${streak}. Last week was missed (${missedWeekReason(missed)}; ${missed.inARow} missed in a row): streak went ${missed.streakBefore} → ${missed.streakAfter}`;
}
