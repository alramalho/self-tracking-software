import type {
  PlanWeekCompletedCell,
  PlanWeekEntry,
  PlanWeekFlexibleCell,
  PlanWeekPlan,
  PlanWeekProjection,
  PlanWeekProjectionInput,
  PlanWeekScheduledSession,
  PlanWeekSummary,
} from "./types";

export type * from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function getPlanWeekDateKey(
  value: Date | string,
  timezone?: string | null
): string {
  const date = new Date(value);

  if (timezone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

export function dateKeyToUTCDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = dateKeyToUTCDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getDaysBetween(startKey: string, count: number): Date[] {
  return Array.from({ length: count }, (_, index) =>
    dateKeyToUTCDate(addDaysToDateKey(startKey, index))
  );
}

export function getPlanWeekStartKey(
  now: Date,
  timezone?: string | null
): string {
  const todayKey = getPlanWeekDateKey(now, timezone);
  const todayDate = dateKeyToUTCDate(todayKey);
  return addDaysToDateKey(todayKey, -todayDate.getUTCDay());
}

function isDateKeyWithin(dateKey: string, startKey: string, endExclusiveKey: string) {
  return dateKey >= startKey && dateKey < endExclusiveKey;
}

function getTimesPerWeekTargetForDays(plan: PlanWeekPlan, days: Date[]): number {
  const timesPerWeek = plan.timesPerWeek ?? 0;
  if (timesPerWeek <= 0 || days.length === 0) return 0;

  if (!plan.finishingDate) {
    return timesPerWeek;
  }

  const firstKey = days[0].toISOString().slice(0, 10);
  const lastKey = days[days.length - 1].toISOString().slice(0, 10);
  const finishingKey = getPlanWeekDateKey(plan.finishingDate, "UTC");

  if (finishingKey < firstKey) {
    return 0;
  }

  if (finishingKey >= lastKey) {
    return timesPerWeek;
  }

  const activeDays =
    Math.floor(
      (dateKeyToUTCDate(finishingKey).getTime() -
        dateKeyToUTCDate(firstKey).getTime()) /
        DAY_MS
    ) + 1;

  return Math.min(timesPerWeek, Math.max(0, activeDays));
}

function placeFlexibleCells(
  openDays: Date[],
  count: number,
  base: Omit<PlanWeekFlexibleCell, "date" | "dateKey" | "kind">,
  out: PlanWeekFlexibleCell[]
) {
  if (count <= 0 || openDays.length === 0) return;

  if (count <= openDays.length) {
    for (let i = 0; i < count; i += 1) {
      const index = Math.min(
        openDays.length - 1,
        Math.floor(((i + 0.5) * openDays.length) / count)
      );
      const date = openDays[index];
      out.push({
        ...base,
        date,
        dateKey: date.toISOString().slice(0, 10),
        kind: "ghost",
      });
    }
    return;
  }

  for (const date of openDays) {
    out.push({
      ...base,
      date,
      dateKey: date.toISOString().slice(0, 10),
      kind: "ghost",
    });
  }

  const overflowDate = openDays[openDays.length - 1];
  for (let i = 0; i < count - openDays.length; i += 1) {
    out.push({
      ...base,
      date: overflowDate,
      dateKey: overflowDate.toISOString().slice(0, 10),
      kind: "overflow",
    });
  }
}

function buildSummary(input: {
  plan: PlanWeekPlan;
  weekIndex: number;
  days: Date[];
  target: number;
  completedDateKeys: string[];
  openDayCount: number;
}): PlanWeekSummary {
  const { plan, weekIndex, days, target, completedDateKeys, openDayCount } = input;
  const completedDays = completedDateKeys.length;
  const remaining = Math.max(0, target - completedDays);
  const overflow = Math.max(0, remaining - openDayCount);
  const slackDays = openDayCount - remaining;
  const status =
    remaining <= 0
      ? "completed"
      : overflow > 0
        ? "overloaded"
        : slackDays <= 1
          ? "at_risk"
          : "on_track";

  return {
    planId: plan.id,
    planGoal: plan.goal,
    planEmoji: plan.emoji,
    outlineType: plan.outlineType,
    weekIndex,
    weekStartKey: days[0].toISOString().slice(0, 10),
    weekEndKey: days[days.length - 1].toISOString().slice(0, 10),
    target,
    completedDays,
    remaining,
    openDays: openDayCount,
    overflow,
    slackDays,
    status,
    completedDateKeys,
  };
}

export function buildPlanWeekProjection(
  input: PlanWeekProjectionInput
): PlanWeekProjection {
  const weekCount = input.weekCount ?? 2;
  const todayKey = getPlanWeekDateKey(input.now, input.timezone);
  const weekStartKey = getPlanWeekStartKey(input.now, input.timezone);
  const windowEndKey = addDaysToDateKey(weekStartKey, weekCount * 7);

  const scheduledSessions: PlanWeekScheduledSession[] = [];
  const flexibleCells: PlanWeekFlexibleCell[] = [];
  const completedCells: PlanWeekCompletedCell[] = [];
  const summaries: PlanWeekSummary[] = [];
  const activityMap = new Map<string, NonNullable<PlanWeekPlan["activities"]>[number]>();
  const scheduledKeys = new Set<string>();

  for (const plan of input.plans) {
    for (const activity of plan.activities ?? []) {
      if (!activityMap.has(activity.id)) {
        activityMap.set(activity.id, activity);
      }
    }

    if (plan.outlineType === "SPECIFIC") {
      for (const session of plan.sessions ?? []) {
        const dateKey = getPlanWeekDateKey(session.date, "UTC");
        if (!isDateKeyWithin(dateKey, weekStartKey, windowEndKey)) continue;

        scheduledKeys.add(`${session.activityId}|${dateKey}`);
        scheduledSessions.push({
          ...session,
          date: dateKeyToUTCDate(dateKey),
          dateKey,
          planId: plan.id,
          planTitle: plan.goal,
          planEmoji: plan.emoji,
        });
      }
      continue;
    }

    if (plan.outlineType !== "TIMES_PER_WEEK") continue;

    const activity = plan.activities?.[0];
    if (!activity || !plan.timesPerWeek) continue;

    const planActivityIds = new Set(plan.activities?.map((item) => item.id) ?? []);
    const entryDateKeys = input.entries
      .filter((entry) => entry.activityId && planActivityIds.has(entry.activityId))
      .map((entry) => getPlanWeekDateKey(entry.datetime, input.timezone));

    for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
      const weekStart = addDaysToDateKey(weekStartKey, weekIndex * 7);
      const weekEndExclusive = addDaysToDateKey(weekStart, 7);
      const days = getDaysBetween(weekStart, 7);
      const completedDateKeys = Array.from(
        new Set(
          entryDateKeys.filter((dateKey) =>
            isDateKeyWithin(dateKey, weekStart, weekEndExclusive)
          )
        )
      ).sort();
      const target = getTimesPerWeekTargetForDays(plan, days);
      const openDays = days.filter((day) => {
        const dateKey = day.toISOString().slice(0, 10);
        return dateKey >= todayKey && !completedDateKeys.includes(dateKey);
      });
      const remaining = Math.max(0, target - completedDateKeys.length);

      summaries.push(
        buildSummary({
          plan,
          weekIndex,
          days,
          target,
          completedDateKeys,
          openDayCount: openDays.length,
        })
      );

      placeFlexibleCells(
        openDays,
        remaining,
        {
          activityId: activity.id,
          planId: plan.id,
          title: plan.goal,
          emoji: plan.emoji,
          state: plan.currentWeekState ?? null,
        },
        flexibleCells
      );
    }
  }

  const completedKeys = new Set<string>();
  for (const entry of input.entries) {
    if (!entry.activityId || !activityMap.has(entry.activityId)) continue;
    const dateKey = getPlanWeekDateKey(entry.datetime, input.timezone);
    if (!isDateKeyWithin(dateKey, weekStartKey, windowEndKey)) continue;
    const key = `${entry.activityId}|${dateKey}`;
    if (scheduledKeys.has(key) || completedKeys.has(key)) continue;
    completedKeys.add(key);
    const activity = activityMap.get(entry.activityId);
    completedCells.push({
      date: dateKeyToUTCDate(dateKey),
      dateKey,
      activityId: entry.activityId,
      planId: "completed",
      title: activity?.title,
      emoji: activity?.emoji,
    });
  }

  return {
    weekStartKey,
    todayKey,
    scheduledSessions,
    flexibleCells,
    completedCells,
    activities: Array.from(activityMap.values()),
    summaries,
  };
}
