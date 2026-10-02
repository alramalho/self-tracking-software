import { format } from "date-fns";
import {
  exampleDone,
  HOLD_MIN_TARGET,
  STREAK_OUTCOMES,
} from "@tsw/prisma/follow-through/streak";
import { asDate, dayKey } from "@/core/dates";
import type { Plan, ProgressWeek } from "@/core/types";
import type { StreakExample, StreakWeek } from "./grid-types";

const weekTarget = (week: ProgressWeek) =>
  week.targetCount ??
  (typeof week.plannedActivities === "number"
    ? week.plannedActivities
    : (week.plannedActivities?.length ?? 0));
const weekDone = (week: ProgressWeek) =>
  week.doneCount ??
  new Set((week.completedActivities ?? []).map((entry) => dayKey(entry.datetime))).size;

/** The plan's weekly target for the example dots (4 when it has none), between 1 and 7. */
export function exampleTarget(plan: Plan): number {
  const latest = [...(plan.progress?.weeks ?? [])].reverse().find((week) => week.outcome);
  const target = plan.timesPerWeek || (latest && weekTarget(latest)) || 4;
  return Math.max(1, Math.min(7, target));
}

/** One example week per outcome. Small targets have no "one short" week: the hold starts at 3 a week. */
export function streakExamples(target: number): StreakExample[] {
  return STREAK_OUTCOMES.filter(
    (row) => row.outcome !== "held" || target >= HOLD_MIN_TARGET,
  ).map((row) => ({ ...row, target, done: exampleDone(row.outcome, target) }));
}

/** The plan's latest finished weeks, oldest first, with what each did to the streak. */
export function recentStreakWeeks(plan: Plan, count = 6): StreakWeek[] {
  return (plan.progress?.weeks ?? [])
    .filter((week) => week.outcome)
    .sort((a, b) => asDate(a.startDate).getTime() - asDate(b.startDate).getTime())
    .slice(-count)
    .map((week) => ({
      key: dayKey(asDate(week.startDate)),
      label: format(asDate(week.startDate), "MMM d"),
      done: weekDone(week),
      target: weekTarget(week),
      outcome: week.outcome!,
    }));
}
