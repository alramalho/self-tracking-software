import { isSameWeek } from "date-fns";
import { streakProgress } from "@tsw/prisma/home-todo";
import { dayKey } from "@/core/dates";
import type { Activity, ActivityEntry, Plan } from "@/core/types";

/** What the log celebration shows: the activity, and the plan's weekly stepper going up (or filling). */
export interface Celebration {
  emoji: string;
  /** "Running · 5 km" */
  line: string;
  plan: {
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
}

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
  return {
    ...base,
    plan: {
      goal: plan.goal,
      emoji: plan.emoji || plan.activities[0]?.emoji || "🎯",
      target,
      before: Math.min(before, target),
      after: Math.min(after, target),
      streakBefore: streak,
      streakAfter: weekDone ? streak + 1 : streak,
    },
    weekDone,
  };
}
