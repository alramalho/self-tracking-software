import { isSameWeek } from "date-fns";
import { streakProgress } from "@tsw/prisma/home-todo";
import { HABIT_WEEKS, LIFESTYLE_WEEKS } from "@tsw/prisma/follow-through/streak";
import { dayKey } from "@/core/dates";
import type { Activity, ActivityEntry, Plan } from "@/core/types";

/** The two badges a plan's streak earns: Habit at 4 weeks, Lifestyle at 9. */
export type Milestone = "habit" | "lifestyle";

/** What the log celebration shows: the activity, and the plan's weekly stepper going up (or filling). */
export interface Celebration {
  emoji: string;
  /** "Running · 5 km" */
  line: string;
  plan: {
    id: string;
    goal: string;
    emoji: string;
    target: number;
    /** Days logged this week before and after this log (the home card's count). */
    before: number;
    after: number;
    streakBefore: number;
    streakAfter: number;
  } | null;
  /** This log filled the week's target. */
  weekDone: boolean;
  /**
   * Filling the week took the streak to the Habit or Lifestyle badge. The server counts the week in progress as
   * soon as it is complete, so this is known at log time and plays straight after "Week done".
   */
  milestone?: Milestone | null;
  /** Shown later, on opening the app, for a badge earned where the log moment couldn't tell (watch, web, dated plans). */
  recap?: boolean;
}

/** The badge a streak earns going from `before` to `after` weeks, if it crosses one. */
export function milestoneFor(before: number, after: number): Milestone | null {
  if (before < LIFESTYLE_WEEKS && after >= LIFESTYLE_WEEKS) return "lifestyle";
  if (before < HABIT_WEEKS && after >= HABIT_WEEKS) return "habit";
  return null;
}

export const MILESTONE_WEEKS: Record<Milestone, number> = { habit: HABIT_WEEKS, lifestyle: LIFESTYLE_WEEKS };

const UNITS: Record<string, string> = { kilometers: "km", kilometer: "km", minutes: "min", minute: "min", hours: "h", hour: "h" };

export function amountLine(activity: Pick<Activity, "title" | "measure">, quantity: number) {
  const measure = activity.measure?.trim() ?? "";
  const unit = UNITS[measure.toLowerCase()] ?? measure.toLowerCase();
  const title = activity.title.charAt(0).toUpperCase() + activity.title.slice(1);
  return `${title} · ${quantity}${unit ? ` ${unit}` : ""}`;
}

/**
 * The plan this log counts towards: an active times-per-week plan with this activity. The stepper only moves
 * when the log is this week and on a day that had no log yet, exactly like the home card's count.
 */
export function celebrationFor(input: {
  activity: Pick<Activity, "id" | "title" | "emoji" | "measure">;
  quantity: number;
  datetime: Date;
  plans: Plan[];
  /** Entries before this log was saved. */
  entries: ActivityEntry[];
  now?: Date;
}): Celebration {
  const now = input.now ?? new Date();
  const base = { emoji: input.activity.emoji || "✅", line: amountLine(input.activity, input.quantity) };
  const plan = input.plans.find(
    (p) =>
      !p.archivedAt &&
      !p.deletedAt &&
      p.outlineType === "TIMES_PER_WEEK" &&
      (p.timesPerWeek ?? 0) > 0 &&
      p.activities.some((a) => a.id === input.activity.id),
  );
  if (!plan || !isSameWeek(input.datetime, now)) return { ...base, plan: null, weekDone: false };
  const week = plan.progress?.weeks?.find((w) => isSameWeek(new Date(w.startDate), now));
  const target = typeof week?.plannedActivities === "number" && week.plannedActivities > 0 ? week.plannedActivities : plan.timesPerWeek!;
  const days = new Set(
    input.entries
      .filter((e) => !e.deletedAt && plan.activities.some((a) => a.id === e.activityId) && isSameWeek(new Date(e.datetime), now))
      .map((e) => dayKey(e.datetime)),
  );
  const before = days.size;
  const after = days.has(dayKey(input.datetime)) ? before : before + 1;
  const weekDone = before < target && after >= target;
  const streak = streakProgress(plan.progress).value;
  const streakAfter = weekDone ? streak + 1 : streak;
  return {
    ...base,
    plan: {
      id: plan.id,
      goal: plan.goal,
      emoji: plan.emoji || plan.activities[0]?.emoji || "🎯",
      target,
      before: Math.min(before, target),
      after: Math.min(after, target),
      streakBefore: streak,
      streakAfter,
    },
    weekDone,
    milestone: weekDone ? milestoneFor(streak, streakAfter) : null,
  };
}
