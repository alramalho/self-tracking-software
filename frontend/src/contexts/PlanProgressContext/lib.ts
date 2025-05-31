import {
  isBefore,
  isAfter,
  format,
  isSameDay,
  parseISO,
  min,
  addWeeks,
  subDays,
} from "date-fns";

import {
  Activity,
  convertApiPlanToPlan,
  ActivityEntry,
  ApiPlan,
  PlanSession,
} from "../UserPlanContext";

import { endOfWeek, startOfWeek } from "date-fns";
import { Plan } from "../UserPlanContext";
import { PlanAchievementResult, PlanWeek } from ".";

export const ACHIEVEMENT_THRESHOLD = 0.8; // 80% completion required
export const ACHIEVEMENT_WEEKS = 12; // Last 12 weeks for achievement calculation
export const LIFESTYLE_START_COUNTING_DATE = subDays(
  new Date(),
  ACHIEVEMENT_WEEKS * 7
);

export const countTimesPerWeekPlanCompletedWeekSessions = (
  plan: ApiPlan,
  userActivityEntries: ActivityEntry[],
  date: Date
) => {
  const completedSessionsThisWeek = userActivityEntries
    .filter((entry) => plan.activity_ids?.includes(entry.activity_id) ?? false)
    .filter((entry) => {
      const entryDate = parseISO(entry.date);
      return (
        entryDate >= startOfWeek(date, { weekStartsOn: 0 }) &&
        entryDate <= endOfWeek(date, { weekStartsOn: 0 })
      );
    })
    .reduce((uniqueDays, entry) => {
      const dayKey = entry.date.split("T")[0];
      uniqueDays.add(dayKey);
      return uniqueDays;
    }, new Set<string>()).size;

  return completedSessionsThisWeek;
};

export const getCompletedOn = (
  session: Plan["sessions"][0],
  plan: Plan,
  userActivityEntries: ActivityEntry[]
) => {
  const weekStart = startOfWeek(session.date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(session.date, { weekStartsOn: 0 });

  const plannedSessionsThisWeek = plan.sessions
    .filter((s) => {
      return (
        s.activity_id === session.activity_id &&
        s.date >= weekStart &&
        s.date <= weekEnd
      );
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const completedSessionsThisWeek = userActivityEntries
    .filter(
      (entry) =>
        entry.activity_id === session.activity_id &&
        parseISO(entry.date) >= weekStart &&
        parseISO(entry.date) <= weekEnd
    )
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  const sessionIndex = plannedSessionsThisWeek.findIndex(
    (s) => s.date === session.date
  );

  return completedSessionsThisWeek[sessionIndex]?.date
    ? parseISO(completedSessionsThisWeek[sessionIndex]?.date)
    : undefined;
};

export const isSessionCompleted = (
  session: Plan["sessions"][0],
  plan: Plan,
  userActivityEntries: ActivityEntry[]
) => {
  const weekStart = startOfWeek(session.date, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(session.date, { weekStartsOn: 0 });

  const plannedSessionsThisWeek = plan.sessions
    .filter((s) => {
      return (
        s.activity_id === session.activity_id &&
        s.date >= weekStart &&
        s.date <= weekEnd
      );
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const completedSessionsThisWeek = userActivityEntries
    .filter(
      (entry) =>
        entry.activity_id === session.activity_id &&
        parseISO(entry.date) >= weekStart &&
        parseISO(entry.date) <= weekEnd
    )
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  const sessionIndex = plannedSessionsThisWeek.findIndex(
    (s) => s.date === session.date
  );
  return completedSessionsThisWeek.length > sessionIndex;
};

export const isWeekCompleted = (
  weekStartDate: Date,
  plan: Plan,
  planActivityEntries: ActivityEntry[]
) => {
  const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 0 });
  const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 0 });

  if (plan.outline_type === "times_per_week") {
    const entriesThisWeek = planActivityEntries.filter((entry) => {
      const entryDate = new Date(entry.date);
      return isAfter(entryDate, weekStart) && isBefore(entryDate, weekEndDate);
    });

    const uniqueDaysWithActivities = new Set(
      entriesThisWeek.map((entry) => format(new Date(entry.date), "yyyy-MM-dd"))
    );

    const isCompleted =
      uniqueDaysWithActivities.size >= (plan.times_per_week || 0);

    return isCompleted;
  } else {
    const plannedSessionsThisWeek = plan.sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return (
        isAfter(sessionDate, weekStart) && isBefore(sessionDate, weekEndDate)
      );
    });

    if (plannedSessionsThisWeek.length === 0) {
      return false;
    }

    const allSessionsCompleted = plannedSessionsThisWeek.every((session) => {
      const sessionDate = new Date(session.date);
      const weekStart = startOfWeek(sessionDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(sessionDate, { weekStartsOn: 0 });

      const completedSessionsThisWeek = planActivityEntries.filter(
        (entry) =>
          entry.activity_id === session.activity_id &&
          isAfter(new Date(entry.date), weekStart) &&
          isBefore(new Date(entry.date), weekEnd)
      );

      return completedSessionsThisWeek.length > 0;
    });

    return allSessionsCompleted;
  }
};

export const calculatePlanAchievement = (
  plan: ApiPlan,
  activities: Activity[],
  activityEntries: ActivityEntry[],
  initialDate?: Date
): PlanAchievementResult => {
  console.log("calculating plan achievement");
  const planActivities = activities.filter(
    (activity) => plan.activity_ids?.includes(activity.id) ?? false
  );
  const planActivityEntries = activityEntries.filter(
    (entry) => plan.activity_ids?.includes(entry.activity_id) ?? false
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
    : min(planActivityEntries.map((entry) => parseISO(entry.date)));

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

  const convertedPlan = convertApiPlanToPlan(plan, planActivities);

  while (
    isAfter(currentWeekStart, weekStart) ||
    isSameDay(weekStart, currentWeekStart)
  ) {
    totalWeeks += 1;
    const isCurrentWeek = isSameDay(weekStart, currentWeekStart);
    const wasCompleted = isWeekCompleted(
      weekStart,
      convertedPlan,
      planActivityEntries
    );

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

  const isAchieved =
    totalWeeks > 0
      ? completedWeeks / totalWeeks >= ACHIEVEMENT_THRESHOLD
      : false;
  const weeksToAchieve =
    Math.ceil(ACHIEVEMENT_WEEKS * ACHIEVEMENT_THRESHOLD) - completedWeeks;

  return {
    streak,
    completedWeeks,
    incompleteWeeks,
    isAchieved,
    totalWeeks,
    weeksToAchieve,
  };
};

export function getPlanWeek(
  date: Date,
  plan: Plan,
  userActivityEntries: ActivityEntry[],
  userActivities: Activity[]
): PlanWeek {
  // Calculate the date range for the week in question (start on Sunday, finish on Saturday)
  const weekStart = startOfWeek(date, { weekStartsOn: 0 }); // 0 = Sunday
  const weekEnd = endOfWeek(date, { weekStartsOn: 0 }); // 0 = Sunday

  // Filter to have available only the activities present in the plan.activity_ids
  const planActivities = userActivities.filter(
    (activity) => plan.activity_ids?.includes(activity.id) ?? false
  );

  // Filter to have only the activity entries that are within that week date range and are part of the plan
  const planActivityEntriesThisWeek = userActivityEntries.filter((entry) => {
    const entryDate = new Date(entry.date);
    const isInPlan = plan.activity_ids?.includes(entry.activity_id) ?? false;
    const isInWeek =
      isAfter(entryDate, weekStart) && isBefore(entryDate, weekEnd);
    return isInPlan && isInWeek;
  });

  // For completed activities, return the performed activity entries this week for that plan
  const completedActivities = planActivityEntriesThisWeek;

  // Check whether the plan is times per week or scheduled sessions
  let plannedActivities: number | PlanSession[];

  if (plan.outline_type === "times_per_week") {
    // If times per week, return the plan activities (not entries!)
    plannedActivities = plan.times_per_week ?? 0;
  } else {
    // If scheduled, return the plan.sessions for this specific week
    const sessionsThisWeek = plan.sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return isAfter(sessionDate, weekStart) && isBefore(sessionDate, weekEnd);
    });
    plannedActivities = sessionsThisWeek;
  }

  return {
    startDate: weekStart,
    activities: planActivities,
    completedActivities,
    plannedActivities,
    weekActivities: planActivities.filter((activity) =>
      planActivityEntriesThisWeek.some(
        (entry) => entry.activity_id === activity.id
      )
    ),
  };
}

export function getPlanWeeks(
  plan: Plan,
  userActivities: Activity[],
  userActivityEntries: ActivityEntry[],
  startDate?: Date
): PlanWeek[] {
  const weeks: PlanWeek[] = [];
  let weekStart = startOfWeek(startDate ?? new Date(), { weekStartsOn: 0 });
  const planEndDate = new Date(plan.finishing_date || addWeeks(weekStart, 12));
  while (isBefore(weekStart, planEndDate)) {
    weeks.push(
      getPlanWeek(weekStart, plan, userActivityEntries, userActivities)
    );
    weekStart = addWeeks(weekStart, 1);
  }
  return weeks;
}
