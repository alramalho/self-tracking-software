/**
 * @deprecated This entire file is deprecated. All plan progress calculations have been moved to the backend.
 * Use the simplified hooks from SimplifiedPlanProgressContext instead:
 * - usePlanProgress(planId) for single plan progress
 * - usePlansProgress(planIds) for multiple plans progress
 * 
 * Backend now provides all necessary data via /plans/:planId/progress endpoint.
 */

import { addWeeks, format, isAfter, isBefore, isSameDay, min } from "date-fns";

import { Activity, ActivityEntry, PlanSession } from "@tsw/prisma";
import { endOfWeek, startOfWeek } from "date-fns";
import { PlanAchievementResult, PlanWeek } from ".";
import { CompletePlan } from "../plans";

// ACHIEVEMENT_WEEKS moved to backend - use backend data instead

/**
 * @deprecated Use backend data from usePlanProgress instead
 */
export const countTimesPerWeekPlanCompletedWeekSessions = (
  plan: CompletePlan,
  userActivityEntries: ActivityEntry[],
  date: Date
) => {
  console.warn('[DEPRECATED] countTimesPerWeekPlanCompletedWeekSessions is deprecated. Use backend data from usePlanProgress instead.');
  const completedSessionsThisWeek = userActivityEntries
    .filter((entry) =>
      plan.activities?.some((activity) => activity.id === entry.activityId)
    )
    .filter((entry) => {
      const entryDate = new Date(entry.date);
      return (
        entryDate >= startOfWeek(date, { weekStartsOn: 0 }) &&
        entryDate <= endOfWeek(date, { weekStartsOn: 0 })
      );
    })
    .reduce((uniqueDays, entry) => {
      const dayKey = new Date(entry.date).toISOString().split("T")[0];
      uniqueDays.add(dayKey);
      return uniqueDays;
    }, new Set<string>()).size;

  return completedSessionsThisWeek;
};

/**
 * @deprecated Use backend data from usePlanProgress instead
 */
export const getCompletedOn = (
  session: PlanSession,
  plan: CompletePlan,
  userActivityEntries: ActivityEntry[]
) => {
  console.warn('[DEPRECATED] getCompletedOn is deprecated. Use backend data from usePlanProgress instead.');
  const weekStart = startOfWeek(session.date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(session.date, { weekStartsOn: 0 });

  const plannedSessionsThisWeek = plan.sessions
    .filter((s) => {
      return (
        s.activityId === session.activityId &&
        s.date >= weekStart &&
        s.date <= weekEnd
      );
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const completedSessionsThisWeek = userActivityEntries
    .filter(
      (entry) =>
        entry.activityId === session.activityId &&
        entry.date >= weekStart &&
        entry.date <= weekEnd
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const sessionIndex = plannedSessionsThisWeek.findIndex(
    (s) => s.date === session.date
  );

  return completedSessionsThisWeek[sessionIndex]?.date
    ? completedSessionsThisWeek[sessionIndex]?.date
    : undefined;
};

/**
 * @deprecated Use backend data from usePlanProgress instead
 */
export const isSessionCompleted = (
  session: PlanSession,
  plan: CompletePlan,
  userActivityEntries: ActivityEntry[]
) => {
  console.warn('[DEPRECATED] isSessionCompleted is deprecated. Use backend data from usePlanProgress instead.');
  const weekStart = startOfWeek(session.date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(session.date, { weekStartsOn: 0 });

  const plannedSessionsThisWeek = plan.sessions
    .filter((s) => {
      return (
        s.activityId === session.activityId &&
        s.date >= weekStart &&
        s.date <= weekEnd
      );
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const completedSessionsThisWeek = userActivityEntries
    .filter(
      (entry) =>
        entry.activityId === session.activityId &&
        entry.date >= weekStart &&
        entry.date <= weekEnd
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const sessionIndex = plannedSessionsThisWeek.findIndex(
    (s) => s.date === session.date
  );
  return completedSessionsThisWeek.length > sessionIndex;
};

/**
 * @deprecated Use backend data from usePlanProgress instead
 */
export const isWeekCompleted = (
  weekStartDate: Date,
  plan: CompletePlan,
  planActivityEntries: ActivityEntry[]
) => {
  console.warn('[DEPRECATED] isWeekCompleted is deprecated. Use backend data from usePlanProgress instead.');
  const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 0 });
  const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 0 });

  if (plan.outlineType === "TIMES_PER_WEEK") {
    const entriesThisWeek = planActivityEntries.filter((entry) => {
      return (
        isAfter(entry.date, weekStart) && isBefore(entry.date, weekEndDate)
      );
    });

    const uniqueDaysWithActivities = new Set(
      entriesThisWeek.map((entry) => format(new Date(entry.date), "yyyy-MM-dd"))
    );

    const isCompleted =
      uniqueDaysWithActivities.size >= (plan.timesPerWeek || 0);

    return isCompleted;
  } else {
    const plannedSessionsThisWeek =
      plan.sessions?.filter((session) => {
        const sessionDate = new Date(session.date);
        return (
          isAfter(sessionDate, weekStart) && isBefore(sessionDate, weekEndDate)
        );
      }) ?? [];

    if (plannedSessionsThisWeek.length === 0) {
      return false;
    }

    const allSessionsCompleted = plannedSessionsThisWeek.every((session) => {
      const sessionDate = new Date(session.date);
      const weekStart = startOfWeek(sessionDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(sessionDate, { weekStartsOn: 0 });

      const completedSessionsThisWeek =
        planActivityEntries.filter(
          (entry) =>
            entry.activityId === session.activityId &&
            isAfter(new Date(entry.date), weekStart) &&
            isBefore(new Date(entry.date), weekEnd)
        ) ?? [];

      return completedSessionsThisWeek.length > 0;
    });

    return allSessionsCompleted;
  }
};

/**
 * @deprecated Use backend data from usePlanProgress instead
 */
export const calculatePlanAchievement = (
  plan: CompletePlan,
  activityEntries: ActivityEntry[],
  initialDate?: Date
): PlanAchievementResult => {
  console.warn('[DEPRECATED] calculatePlanAchievement is deprecated. Use backend data from usePlanProgress instead.');
  const planActivityEntries = activityEntries.filter(
    (entry) => plan.activities?.some((a) => a.id === entry.activityId) ?? false
  );

  if (planActivityEntries.length === 0) {
    return {
      streak: 0,
      completedWeeks: 0,
      incompleteWeeks: 0,
      isAchieved: false,
      totalWeeks: 0,
    };
  }

  const firstEntryDate = initialDate
    ? initialDate
    : min(planActivityEntries.map((entry) => new Date(entry.date)));

  const now = new Date();
  const currentWeekStart = startOfWeek(now, {
    weekStartsOn: 0,
  });

  let weekStart = startOfWeek(firstEntryDate, {
    weekStartsOn: 0,
  });

  let streak = 0;
  let completedWeeks = 0;
  let incompleteWeeks = 0;
  let totalWeeks = 0;

  while (
    isAfter(currentWeekStart, weekStart) ||
    isSameDay(weekStart, currentWeekStart)
  ) {
    totalWeeks += 1;
    const isCurrentWeek = isSameDay(weekStart, currentWeekStart);
    const wasCompleted = isWeekCompleted(weekStart, plan, planActivityEntries);

    if (wasCompleted) {
      streak += 1;
      completedWeeks += 1;
      if (!isCurrentWeek) {
        incompleteWeeks = 0;
      }
    } else if (!isCurrentWeek) {
      incompleteWeeks += 1;
      if (incompleteWeeks > 1) {
        streak = Math.max(0, streak - 1);
      }
    }

    weekStart = addWeeks(weekStart, 1);
  }

  // Note: Achievement logic moved to backend
  // Frontend should use backend data instead of calculating locally
  const LEGACY_ACHIEVEMENT_WEEKS = 9; // Temporary fallback for local calculations
  const isAchieved = streak >= LEGACY_ACHIEVEMENT_WEEKS;
  const weeksToAchieve = LEGACY_ACHIEVEMENT_WEEKS - streak;

  return {
    streak,
    completedWeeks,
    incompleteWeeks,
    isAchieved,
    totalWeeks,
    weeksToAchieve,
  };
};

/**
 * @deprecated Use backend data from usePlanProgress instead
 */
export function getPlanWeek(
  date: Date,
  plan: CompletePlan,
  userActivityEntries: ActivityEntry[],
  userActivities: Activity[]
): PlanWeek {
  console.warn('[DEPRECATED] getPlanWeek is deprecated. Use backend data from usePlanProgress instead.');
  // Calculate the date range for the week in question (start on Sunday, finish on Saturday)
  const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // 0 = Sunday
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 }); // 0 = Sunday

  // Filter to have available only the activities present in the plan.activityIds
  const planActivities = userActivities.filter(
    (activity) => plan.activities?.some((a) => a.id === activity.id) ?? false
  );

  // Filter to have only the activity entries that are within that week date range and are part of the plan
  const planActivityEntriesThisWeek = userActivityEntries.filter((entry) => {
    const isInPlan =
      plan.activities?.some((a) => a.id === entry.activityId) ?? false;
    const isInWeek =
      isAfter(entry.date, weekStart) && isBefore(entry.date, weekEnd);
    return isInPlan && isInWeek;
  });

  // For completed activities, return the performed activity entries this week for that plan
  const completedActivities = planActivityEntriesThisWeek;

  // Check whether the plan is times per week or scheduled sessions
  let plannedActivities: number | PlanSession[];

  if (plan.outlineType === "TIMES_PER_WEEK") {
    // If times per week, return the plan activities (not entries!)
    plannedActivities = plan.timesPerWeek ?? 0;
  } else {
    // If scheduled, return the plan.sessions for this specific week
    const sessionsThisWeek = plan.sessions?.filter((session) => {
      const sessionDate = new Date(session.date);
      return isAfter(sessionDate, weekStart) && isBefore(sessionDate, weekEnd);
    });
    plannedActivities = sessionsThisWeek;
  }

  let weekActivities: Activity[];

  if (plan.outlineType === "TIMES_PER_WEEK") {
    weekActivities = planActivities;
  } else {
    const sessionsThisWeek = plan.sessions?.filter((session) => {
      const sessionDate = new Date(session.date);
      return isAfter(sessionDate, weekStart) && isBefore(sessionDate, weekEnd);
    });

    const activityIdsThisWeek = Array.from(
      new Set(sessionsThisWeek.map((session) => session.activityId))
    );

    weekActivities = planActivities.filter((activity) =>
      activityIdsThisWeek.includes(activity.id)
    );
  }

  return {
    startDate: weekStart,
    activities: planActivities,
    completedActivities,
    plannedActivities,
    weekActivities,
  };
}

/**
 * @deprecated Use backend data from usePlanProgress instead
 */
export function getPlanWeeks(
  plan: CompletePlan,
  userActivities: Activity[],
  userActivityEntries: ActivityEntry[],
  startDate?: Date
): PlanWeek[] {
  console.warn('[DEPRECATED] getPlanWeeks is deprecated. Use backend data from usePlanProgress instead.');
  const weeks: PlanWeek[] = [];
  let weekStart = startOfWeek(startDate ?? new Date(), { weekStartsOn: 0 });
  const LEGACY_ACHIEVEMENT_WEEKS = 9; // Temporary fallback
  const planEndDate = new Date(
    plan.finishingDate || addWeeks(weekStart, LEGACY_ACHIEVEMENT_WEEKS)
  );
  while (isBefore(weekStart, planEndDate)) {
    weeks.push(
      getPlanWeek(weekStart, plan, userActivityEntries, userActivities)
    );
    weekStart = addWeeks(weekStart, 1);
  }
  return weeks;
}
