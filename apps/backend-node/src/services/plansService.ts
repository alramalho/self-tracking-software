import { TZDate } from "@date-fns/tz";
import {
  Activity,
  ActivityEntry,
  Plan,
  PlanOutlineType,
  PlanSession,
  PlanState,
  User,
} from "@tsw/prisma";
import { PlanProgressData, PlanProgressState } from "@tsw/prisma/types";
import {
  addWeeks,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isThisWeek,
  startOfWeek,
} from "date-fns";
import { todaysLocalDate, toMidnightUTCDate } from "../utils/date";
import { withErrorHandling } from "../utils/errorHandling";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { aiService } from "./aiService";
import { embeddingService } from "./embeddingService";

function is3DaysOld(date: Date): boolean {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  return isBefore(date, threeDaysAgo);
}
type PlanWeek = {
  startDate: Date;
  activities: Activity[];
  completedActivities: ActivityEntry[];
  plannedActivities: number | PlanSession[];
  weekActivities: Activity[];
  isCompleted: boolean;
};
export class PlansService {
  constructor() {
    // Inject this service into aiService to avoid circular dependency
    aiService.setPlansService(this);
  }
  async getUserFirstPlan(userId: string) {
    try {
      const plans = await prisma.plan.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        include: {
          sessions: {
            include: {
              activity: true,
            },
          },
          activities: true,
        },
        orderBy: [{ createdAt: "desc" }],
      });

      // Return the coached plan, or the first plan if none are coached
      const coachedPlan = plans.find((p: any) => p.isCoached);
      return coachedPlan || (plans.length > 0 ? plans[0] : null);
    } catch (error) {
      logger.error("Error getting user's first plan:", error);
      throw error;
    }
  }

  async getPlanWeekStats(
    planWithActivities: Plan & { activities: any[] },
    user: User
  ): Promise<{
    numActiveDaysInTheWeek: number;
    numLeftDaysInTheWeek: number;
    numActiveDaysLeftInTheWeek: number;
    daysCompletedThisWeek: number;
  }> {
    // Use user's timezone or default to UTC
    const timezone = user.timezone || "UTC";
    const currentDate = new Date();

    // Convert to user's timezone for accurate week calculation
    const userCurrentDate = toMidnightUTCDate(
      new TZDate(currentDate, timezone)
    );

    // Get the weeks data which includes current week
    const weeks = await this.getPlanWeeks(planWithActivities, user);

    // Find the current week from the weeks data
    const currentWeekStart = toMidnightUTCDate(
      startOfWeek(userCurrentDate, { weekStartsOn: 0 })
    );

    const currentWeek = weeks.find((week) =>
      isSameDay(week.startDate, currentWeekStart)
    );

    if (!currentWeek) {
      // Fallback if current week not found in weeks data
      logger.warn(
        `Current week not found in weeks data for plan ${planWithActivities.goal}`
      );
      return {
        numActiveDaysInTheWeek: 0,
        numLeftDaysInTheWeek: 0,
        numActiveDaysLeftInTheWeek: 0,
        daysCompletedThisWeek: 0,
      };
    }

    // Calculate days left in the week
    const weekEnd = toMidnightUTCDate(
      endOfWeek(userCurrentDate, { weekStartsOn: 0 })
    );
    const numLeftDaysInTheWeek = Math.max(
      0,
      Math.floor(
        (weekEnd.getTime() - userCurrentDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    );

    // Extract stats from the current week data
    const daysCompletedThisWeek = new Set(
      currentWeek.completedActivities.map((activity) =>
        format(new Date(activity.date), "yyyy-MM-dd")
      )
    ).size;

    let numActiveDaysInTheWeek: number;
    if (typeof currentWeek.plannedActivities === "number") {
      numActiveDaysInTheWeek = currentWeek.plannedActivities;
    } else {
      // For scheduled plans, count unique days with sessions
      const uniqueDays = new Set(
        currentWeek.plannedActivities.map((session) =>
          format(new Date(session.date), "yyyy-MM-dd")
        )
      );
      numActiveDaysInTheWeek = uniqueDays.size;
    }

    const numActiveDaysLeftInTheWeek = Math.max(
      0,
      numActiveDaysInTheWeek - daysCompletedThisWeek
    );

    logger.debug(
      `User ${user.username} has ${numLeftDaysInTheWeek} left days in the week`
    );
    logger.debug(
      `User ${user.username} has completed ${daysCompletedThisWeek} days this week`
    );
    logger.debug(
      `Plan ${planWithActivities.goal} (${planWithActivities.outlineType}) has ${numActiveDaysInTheWeek} planned active days this week`
    );
    logger.debug(
      `Plan ${planWithActivities.goal} (${planWithActivities.outlineType}) has ${numActiveDaysLeftInTheWeek} active days left this week`
    );

    return {
      numActiveDaysInTheWeek,
      numLeftDaysInTheWeek,
      numActiveDaysLeftInTheWeek,
      daysCompletedThisWeek,
    };
  }

  async recalculateCurrentWeekState(
    plan: Plan,
    user: User
  ): Promise<Plan & { activities: Activity[] }> {
    try {
      logger.info(
        `Recalculating current week state for plan '${plan.goal}' of user '${user.username}'`
      );
      const planWithRelations = await prisma.plan.findUnique({
        where: { id: plan.id },
        include: {
          activities: true,
        },
      });

      if (!planWithRelations) {
        throw new Error(`Plan ${plan.id} not found`);
      }

      const {
        numActiveDaysInTheWeek,
        numLeftDaysInTheWeek,
        numActiveDaysLeftInTheWeek,
        daysCompletedThisWeek,
      } = await this.getPlanWeekStats(planWithRelations, user);

      // Determine the state based on completion vs planned activities
      let newState: PlanState;
      if (numActiveDaysLeftInTheWeek <= 0) {
        newState = PlanState.COMPLETED;
      } else {
        const marginForError = Math.max(
          -1,
          numLeftDaysInTheWeek - numActiveDaysLeftInTheWeek
        );

        if (marginForError < 0) {
          logger.debug(
            `Margin (${marginForError}) is less than 0 - plan is failed`
          );
          newState = PlanState.FAILED;
        } else if (marginForError >= 2) {
          logger.debug(
            `Margin (${marginForError}) is greater than 2 - plan is on track`
          );
          newState = PlanState.ON_TRACK;
        } else {
          logger.debug(
            `Margin (${marginForError}) is between 0 and 2 - plan is at risk`
          );
          newState = PlanState.AT_RISK;
        }
      }

      // Update the plan's current week state
      const oldState = planWithRelations.currentWeekState;
      const updatedPlan = await prisma.plan.update({
        where: { id: plan.id },
        data: {
          currentWeekState: newState,
          currentWeekStateCalculatedAt: new Date(),
        },
        include: {
          activities: true,
          sessions: true,
        },
      });

      if (oldState !== newState) {
        logger.info(
          `Plan '${plan.goal}' of user '${user.username}' state transition: ${oldState} -> ${newState}`
        );

        // Await state transition to ensure coach notes are generated before returning
        await this.processStateTransition(updatedPlan, user, newState);
      }

      logger.info(
        `Updated plan '${plan.goal}' of user '${user.username}' current week state from ${oldState} to ${newState}`
      );

      // Fetch the updated plan with coach notes
      const finalPlan = await prisma.plan.findUnique({
        where: { id: plan.id },
        include: {
          activities: true,
        },
      });

      return finalPlan as Plan & { activities: Activity[] };
    } catch (error) {
      logger.error("Error recalculating plan week state:", error);
      throw error;
    }
  }

  private async processStateTransition(
    plan: Plan & { activities?: any[]; sessions?: PlanSession[] },
    user: User,
    newState: PlanState
  ): Promise<void> {
    try {
      logger.info(
        `Processing state transition for plan '${plan.goal}' to state '${newState}'`
      );

      // Get plan activities for processing
      const planWithActivities = await prisma.plan.findUnique({
        where: { id: plan.id },
        include: { activities: true },
      });

      if (!planWithActivities) {
        throw new Error(`Plan ${plan.id} not found for state transition`);
      }

      let updatePlanData: Partial<Plan> = {};
      let changes:
        | {
            type: "times_reduced" | "sessions_downgraded" | "none";
            oldTimesPerWeek?: number;
            newTimesPerWeek?: number;
            oldSessions?: Array<{
              date: string;
              activityId: string;
              quantity: number;
              descriptiveGuide?: string;
            }>;
            newSessions?: Array<{
              date: string;
              activityId: string;
              quantity: number;
              descriptiveGuide?: string;
            }>;
          }
        | undefined = { type: "none" };

      if (
        newState === PlanState.FAILED &&
        (plan.suggestedByCoachAt ? !isThisWeek(plan.suggestedByCoachAt) : true)
      ) {
        if (plan.outlineType === PlanOutlineType.TIMES_PER_WEEK) {
          // Reduce times per week by 1 (minimum 1)
          const oldTimesPerWeek = plan.timesPerWeek || 1;
          const newTimesPerWeek = Math.max(1, oldTimesPerWeek - 1);
          updatePlanData.coachSuggestedTimesPerWeek = newTimesPerWeek;
          updatePlanData.suggestedByCoachAt = new Date();

          changes = {
            type: "times_reduced",
            oldTimesPerWeek,
            newTimesPerWeek,
          };
        }
        if (plan.outlineType === PlanOutlineType.SPECIFIC) {
          const suggestedSessions = await aiService.generatePlanSessions({
            goal: plan.goal,
            activities: planWithActivities.activities,
            existingPlan: plan,
            description:
              "The user has failed the current plan's week." +
              "Please adapt the next week so it is downgraded 1 level of difficulty." +
              "The update should be minimal",
          });

          // Get old sessions (upcoming sessions that will be replaced)
          const oldSessions = (plan.sessions || [])
            .filter((s) => new Date(s.date) >= new Date())
            .slice(0, 10) // Limit to next 10 sessions for context
            .map((s) => ({
              date: s.date.toISOString(),
              activityId: s.activityId,
              quantity: s.quantity,
              descriptiveGuide: s.descriptiveGuide || undefined,
            }));

          const actualNewSessions =
            await prisma.planSession.createManyAndReturn({
              data: suggestedSessions.sessions.map((session) => ({
                planId: plan.id,
                date: session.date,
                activityId: session.activityId,
                quantity: session.quantity,
                isCoachSuggested: true,
              })),
            });

          const newSessions = actualNewSessions.slice(0, 10).map((s) => ({
            date: s.date.toISOString(),
            activityId: s.activityId,
            quantity: s.quantity,
            descriptiveGuide: s.descriptiveGuide || undefined,
          }));

          changes = {
            type: "sessions_downgraded",
            oldSessions,
            newSessions,
          };

          updatePlanData.suggestedByCoachAt = new Date();
        }
      }

      const coachNotes = await aiService.generateCoachNotes(
        {
          goal: plan.goal,
          outlineType: plan.outlineType,
          timesPerWeek: plan.timesPerWeek || undefined,
        },
        newState,
        planWithActivities.activities,
        changes
      );
      updatePlanData.coachNotes = coachNotes;

      await prisma.plan.update({
        where: { id: plan.id },
        data: updatePlanData as any, // Type assertion needed for partial update
      });

      logger.info(
        `State transition processing completed for plan '${plan.goal}'`
      );
    } catch (error) {
      logger.error(
        `Error in processStateTransition for plan ${plan.id}:`,
        error
      );
      throw error;
    }
  }

  // Streak and achievement calculation methods moved from frontend
  private readonly HABIT_WEEKS = 4;
  private readonly LIFESTYLE_WEEKS = 9;

  async calculatePlanAchievement(
    planId: string,
    initialDate?: Date
  ): Promise<{
    streak: number;
    completedWeeks: number;
    incompleteWeeks: number;
    totalWeeks: number;
  }> {
    // Get plan with activities and sessions
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        activities: true,
        sessions: true,
      },
    });
    const user = await prisma.user.findFirst({ where: { id: plan?.userId } });

    if (!plan || !user) {
      throw new Error(`Plan ${planId} or user not found`);
    }

    // Get weeks data which includes all completion information
    const weeks = await this.getPlanWeeks(plan, user, initialDate);

    if (weeks.length === 0) {
      return {
        streak: 0,
        completedWeeks: 0,
        incompleteWeeks: 0,
        totalWeeks: 0,
      };
    }

    const now = new Date();

    const currentWeekStart = toMidnightUTCDate(
      startOfWeek(now, {
        weekStartsOn: 0,
      })
    );

    let streak = 0;
    let completedWeeks = 0;
    let incompleteWeeks = 0;
    let totalWeeks = 0;

    // Iterate through weeks up to current week
    for (const week of weeks) {
      const weekStart = toMidnightUTCDate(
        startOfWeek(week.startDate, {
          weekStartsOn: 0,
        })
      );
      const isCurrentWeek = isSameDay(weekStart, currentWeekStart);
      const isBeforeCurrentWeek = isBefore(weekStart, currentWeekStart);

      // Only process weeks up to and including current week
      if (!isCurrentWeek && !isBeforeCurrentWeek) {
        break;
      }

      totalWeeks += 1;
      const wasCompleted = week.isCompleted;

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
    }

    return {
      streak: Math.max(0, streak),
      completedWeeks,
      incompleteWeeks,
      totalWeeks,
    };
  }

  private calculateHabitAchievement(achievement: {
    streak: number;
    completedWeeks: number;
    incompleteWeeks: number;
    totalWeeks: number;
  }): {
    progressValue: number;
    maxValue: number;
    isAchieved: boolean;
    progressPercentage: number;
  } {
    const maxValue = this.HABIT_WEEKS; // 4 weeks
    const progressValue = Math.min(maxValue, achievement.streak);
    const isAchieved = achievement.streak >= maxValue;
    const progressPercentage = Math.round((progressValue / maxValue) * 100);

    return {
      progressValue,
      maxValue,
      isAchieved,
      progressPercentage,
    };
  }

  private calculateLifestyleAchievement(achievement: {
    streak: number;
    completedWeeks: number;
    incompleteWeeks: number;
    totalWeeks: number;
  }): {
    progressValue: number;
    maxValue: number;
    isAchieved: boolean;
    progressPercentage: number;
  } {
    const maxValue = this.LIFESTYLE_WEEKS; // 9 weeks
    const progressValue = Math.min(maxValue, achievement.streak);
    const isAchieved = achievement.streak >= maxValue;
    const progressPercentage = Math.round((progressValue / maxValue) * 100);

    return {
      progressValue,
      maxValue,
      isAchieved,
      progressPercentage,
    };
  }

  async getBatchPlanProgress(
    planIds: string[],
    userId: string,
    forceRecompute: boolean = false
  ): Promise<PlanProgressData[]> {
    const plans = await prisma.plan.findMany({
      where: { id: { in: planIds } },
      include: { activities: true },
    });

    if (!plans) {
      throw new Error(`Plans ${planIds.join(", ")} not found.`);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    let cachedCount = 0;
    let computedCount = 0;

    const progressPromises = Promise.all(
      plans.map(async (plan) => {
        const shouldRecompute =
          !plan.progressCalculatedAt ||
          forceRecompute ||
          is3DaysOld(plan.progressCalculatedAt);

        if (shouldRecompute) {
          computedCount++;
          return this.computePlanProgress(plan, user);
        } else {
          cachedCount++;
          return this.getPlanProgress(plan, user);
        }
      })
    );

    const results = await progressPromises;
    logger.info(
      `Batch progress: ${cachedCount} cached, ${computedCount} computed (${plans.length} total)`
    );
    return results;
  }

  async getPlanProgress(
    plan: Plan & { activities: Activity[] },
    user: User
  ): Promise<PlanProgressData> {
    // If progress has never been calculated, compute it now
    if (!plan.progressCalculatedAt) {
      logger.info(
        `Progress never calculated for plan ${plan.id}, computing now`
      );
      return this.computePlanProgress(plan, user);
    }

    // Just read from cached progress state
    if (!plan.progressState) {
      logger.warn(
        `No cached progress found for plan ${plan.id}, computing fresh`
      );
      return this.computePlanProgress(plan, user);
    }

    logger.info(`Reading cached progress for plan ${plan.id}`);

    const cachedState = plan.progressState as any as PlanProgressState;

    return {
      plan: {
        emoji: plan.emoji || "🔥",
        goal: plan.goal,
        id: plan.id,
        type: plan.outlineType,
      },
      achievement: {
        ...cachedState!.achievement,
        achievedLastStreakAt: cachedState!.achievement.achievedLastStreakAt ?? null,
        celebratedStreakAt: cachedState!.achievement.celebratedStreakAt ?? null,
      },
      currentWeekStats: cachedState!.currentWeekStats,
      habitAchievement: {
        ...cachedState!.habitAchievement,
        achievedAt: cachedState!.habitAchievement.achievedAt ?? null,
        celebratedAt: cachedState!.habitAchievement.celebratedAt ?? null,
      },
      lifestyleAchievement: {
        ...cachedState!.lifestyleAchievement,
        achievedAt: cachedState!.lifestyleAchievement.achievedAt ?? null,
        celebratedAt: cachedState!.lifestyleAchievement.celebratedAt ?? null,
      },
      weeks: cachedState!.weeks || [],
      currentWeekState: cachedState!.currentWeekState,
    };
  }

  async computePlanProgress(
    plan: Plan & { activities: Activity[] },
    user: User
  ): Promise<PlanProgressData> {
    const progressData = await this.getSinglePlanProgress(plan, user);

    // Get old progress state to compare achievements
    const oldProgressState = plan.progressState as any as PlanProgressState;

    // Track streak achievement dates
    const oldStreak = oldProgressState?.achievement?.streak ?? 0;
    const newStreak = progressData.achievement.streak;
    const achievedLastStreakAt = newStreak > oldStreak
      ? new Date()
      : oldProgressState?.achievement?.achievedLastStreakAt ?? null;
    const celebratedStreakAt = oldProgressState?.achievement?.celebratedStreakAt ?? null;

    // Track habit achievement dates
    const wasHabitAchieved = oldProgressState?.habitAchievement?.isAchieved ?? false;
    const isHabitAchieved = progressData.habitAchievement.isAchieved;
    const habitAchievedAt = !wasHabitAchieved && isHabitAchieved
      ? new Date()
      : oldProgressState?.habitAchievement?.achievedAt ?? null;
    const habitCelebratedAt = oldProgressState?.habitAchievement?.celebratedAt ?? null;

    // Track lifestyle achievement dates
    const wasLifestyleAchieved = oldProgressState?.lifestyleAchievement?.isAchieved ?? false;
    const isLifestyleAchieved = progressData.lifestyleAchievement.isAchieved;
    const lifestyleAchievedAt = !wasLifestyleAchieved && isLifestyleAchieved
      ? new Date()
      : oldProgressState?.lifestyleAchievement?.achievedAt ?? null;
    const lifestyleCelebratedAt = oldProgressState?.lifestyleAchievement?.celebratedAt ?? null;

    // Cache the computed progress with achievement dates
    const progressState: PlanProgressState = {
      achievement: {
        ...progressData.achievement,
        achievedLastStreakAt,
        celebratedStreakAt,
      },
      currentWeekStats: progressData.currentWeekStats,
      habitAchievement: {
        ...progressData.habitAchievement,
        achievedAt: habitAchievedAt,
        celebratedAt: habitCelebratedAt,
      },
      lifestyleAchievement: {
        ...progressData.lifestyleAchievement,
        achievedAt: lifestyleAchievedAt,
        celebratedAt: lifestyleCelebratedAt,
      },
      currentWeekState: plan.currentWeekState,
      weeks: progressData.weeks,
    };

    await prisma.plan.update({
      where: { id: plan.id },
      data: {
        progressState,
        progressCalculatedAt: new Date(),
      },
    });

    logger.info(`Cached fresh progress for plan ${plan.id}`);
    return progressData;
  }

  async invalidatePlanProgressCache(planId: string): Promise<void> {
    await prisma.plan.update({
      where: { id: planId },
      data: {
        progressCalculatedAt: null,
      },
    });
    logger.info(`Invalidated progress cache for plan ${planId}`);
  }

  async invalidateUserPlanProgressCaches(
    userId: string,
    activityIds: string[]
  ): Promise<void> {
    // Find all plans that use the affected activities
    const affectedPlans = await prisma.plan.findMany({
      where: {
        userId,
        deletedAt: null,
        activities: {
          some: {
            id: { in: activityIds },
          },
        },
      },
      select: { id: true },
    });

    if (affectedPlans.length > 0) {
      await prisma.plan.updateMany({
        where: {
          id: { in: affectedPlans.map((p) => p.id) },
        },
        data: {
          progressCalculatedAt: null,
        },
      });

      logger.info(
        `Invalidated progress cache for ${affectedPlans.length} plans affected by activity changes`
      );
    }
  }

  private async getSinglePlanProgress(
    plan: Plan & { activities: Activity[] },
    user: User
  ): Promise<PlanProgressData> {
    // Get achievement data
    const achievement = await this.calculatePlanAchievement(plan.id);

    // Get current week stats
    const currentWeekStats = await this.getPlanWeekStats(plan, user);

    // Calculate habit and lifestyle achievements
    const habitAchievement = this.calculateHabitAchievement(achievement);
    const lifestyleAchievement =
      this.calculateLifestyleAchievement(achievement);

    // Get weeks data
    const weeks = await this.getPlanWeeks(plan, user);

    return {
      plan: {
        emoji: plan.emoji || "🔥",
        goal: plan.goal,
        id: plan.id,
        type: plan.outlineType,
      },
      achievement,
      currentWeekStats,
      habitAchievement,
      lifestyleAchievement,
      currentWeekState: plan.currentWeekState,
      weeks,
    };
  }

  private async getPlanWeek(
    date: Date,
    plan: Plan & { activities: Activity[]; sessions?: PlanSession[] },
    userActivities: Activity[]
  ): Promise<{
    startDate: Date;
    activities: Activity[];
    completedActivities: ActivityEntry[];
    plannedActivities: number | PlanSession[];
    weekActivities: Activity[];
    isCompleted: boolean;
  }> {
    // Calculate the date range for the week in question (start on Sunday, finish on Saturday)
    const weekStart = toMidnightUTCDate(startOfWeek(date, { weekStartsOn: 0 })); // 0 = Sunday
    const weekEnd = toMidnightUTCDate(endOfWeek(date, { weekStartsOn: 0 })); // 0 = Sunday

    // Filter to have available only the activities present in the plan.activities
    const planActivities = userActivities.filter((activity) =>
      plan.activities?.some((a) => a.id === activity.id)
    );

    // Get activity entries for this week
    const planActivityEntriesThisWeek = await prisma.activityEntry.findMany({
      where: {
        activityId: { in: plan.activities.map((a) => a.id) },
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
        deletedAt: null,
      },
    });

    // For completed activities, return the performed activity entries this week for that plan
    const completedActivities = planActivityEntriesThisWeek;
    const numberOfDaysCompletedThisWeek = // must be completedActivites but as a set for .date as YYYY-MM-DD
      new Set(
        completedActivities.map((activity) =>
          format(new Date(activity.date), "yyyy-MM-dd")
        )
      ).size;

    // Check whether the plan is times per week or scheduled sessions
    let plannedActivities: number | PlanSession[];

    if (plan.outlineType === "TIMES_PER_WEEK") {
      // If times per week, return the plan activities (not entries!)
      plannedActivities = plan.timesPerWeek ?? 0;
    } else {
      // If scheduled, return the plan.sessions for this specific week
      const sessionsThisWeek = plan.sessions?.filter((session) => {
        const sessionDate = new Date(session.date);
        return (
          isAfter(sessionDate, weekStart) && isBefore(sessionDate, weekEnd)
        );
      });
      plannedActivities = sessionsThisWeek ?? 0;
    }

    let weekActivities: Activity[];

    if (plan.outlineType === "TIMES_PER_WEEK") {
      weekActivities = planActivities;
    } else {
      const sessionsThisWeek = plan.sessions?.filter((session) => {
        const sessionDate = new Date(session.date);
        return (
          isAfter(sessionDate, weekStart) && isBefore(sessionDate, weekEnd)
        );
      });

      const activityIdsThisWeek = Array.from(
        new Set(sessionsThisWeek?.map((session) => session.activityId) ?? [])
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
      isCompleted:
        completedActivities.length > 0 &&
        numberOfDaysCompletedThisWeek >=
          (typeof plannedActivities === "number"
            ? plannedActivities
            : (plannedActivities?.length ?? 0)),
    };
  }

  private async getPlanWeeks(
    plan: Plan & { activities: Activity[]; sessions?: PlanSession[] },
    user: User,
    startDate?: Date
  ): Promise<Array<PlanWeek>> {
    // Get user activities
    const userActivities = await prisma.activity.findMany({
      where: { userId: user.id },
    });

    // Get plan with sessions if not already included
    const planWithSessions = plan.sessions
      ? plan
      : await prisma.plan.findUnique({
          where: { id: plan.id },
          include: {
            activities: true,
            sessions: true,
          },
        });

    if (!planWithSessions) {
      throw new Error(`Plan ${plan.id} not found`);
    }

    // Find the earliest activity entry date for this plan's activities
    const activityEntries = await prisma.activityEntry.findMany({
      where: {
        activityId: { in: plan.activities.map((a) => a.id) },
        deletedAt: null,
      },
      orderBy: {
        date: "asc",
      },
      take: 1,
    });

    // Determine the actual start date - either the earliest activity entry or the provided startDate
    let actualStartDate: Date;
    if (startDate) {
      actualStartDate = startDate;
    } else if (activityEntries.length > 0) {
      actualStartDate = toMidnightUTCDate(activityEntries[0].date);
    } else {
      // If no activity entries exist, start from current week
      actualStartDate = todaysLocalDate();
    }

    const weeks: Array<PlanWeek> = [];

    let weekStart = toMidnightUTCDate(
      startOfWeek(actualStartDate, { weekStartsOn: 0 })
    );
    const planEndDate = new Date(
      plan.finishingDate || addWeeks(new Date(), this.LIFESTYLE_WEEKS)
    );

    while (
      isBefore(weekStart, planEndDate) ||
      isSameDay(
        weekStart,
        toMidnightUTCDate(startOfWeek(planEndDate, { weekStartsOn: 0 }))
      )
    ) {
      const weekData = await this.getPlanWeek(
        weekStart,
        planWithSessions,
        userActivities
      );
      weeks.push(weekData);
      weekStart = toMidnightUTCDate(addWeeks(weekStart, 1));
    }

    return weeks;
  }

  async getPlanEmbedding(planId: string): Promise<number[] | null> {
    try {
      // TODO: dont do this ::tesxt BS, just check if field is null or not
      const result = await prisma.$queryRaw<
        Array<{ id: string; goal: string; embedding: string | null }>
      >`SELECT id, goal, "embedding"::text as "embedding" FROM "plans" WHERE id = ${planId}`;
      const plan = result.length > 0 ? result[0] : null;

      if (!plan) {
        logger.warn(`Plan ${planId} not found`);
        return null;
      }

      // Return existing embedding if available
      if (plan.embedding) {
        // Parse the vector string format "[1.0, 2.0, ...]" to number array
        const embedding = JSON.parse(plan.embedding);
        return embedding;
      }

      // Generate new embedding
      return await this.updatePlanEmbedding(planId);
    } catch (error) {
      logger.error(`Error getting plan embedding for ${planId}:`, error);
      return null;
    }
  }

  async getReadablePlan(planId: string): Promise<string> {
    return withErrorHandling(
      async () => {
        const plan = await prisma.plan.findUnique({
          where: { id: planId },
          include: {
            activities: true,
            sessions: {
              where: {
                date: {
                  gte: new Date(),
                },
              },
              take: 10,
              orderBy: { date: "asc" },
            },
          },
        });

        if (!plan) {
          return "";
        }

        const activityNames = plan.activities.map((a) => a.title);
        return `${plan.goal} (${activityNames.join(", ")})`;
      },
      { fallback: "", errorMsg: "Error generating readable plan" }
    );
  }

  private async processReadablePlansForBatch(
    batchIds: string[]
  ): Promise<Array<{ planId: string; text: string }>> {
    const readablePlans: Array<{ planId: string; text: string }> = [];

    for (const planId of batchIds) {
      const readablePlan = await this.getReadablePlan(planId);
      if (readablePlan) {
        readablePlans.push({ planId, text: readablePlan });
      } else {
        logger.warn(`No readable text generated for plan ${planId}`);
      }
    }

    return readablePlans;
  }

  private async updatePlanEmbeddingInDb(
    planId: string,
    embedding: number[]
  ): Promise<boolean> {
    return withErrorHandling(
      async () => {
        await prisma.$executeRaw`
          UPDATE plans
          SET "embedding" = ${JSON.stringify(embedding)}::vector
          WHERE id = ${planId}
        `;
        logger.info(`Updated plan embedding for plan ${planId}`);
        return true;
      },
      { fallback: false, errorMsg: `Failed to update plan ${planId}` }
    );
  }

  async updatePlanEmbeddingsBatch(
    planIds: string[]
  ): Promise<Map<string, number[] | null>> {
    const results = new Map<string, number[] | null>();

    if (planIds.length === 0) {
      return results;
    }

    return withErrorHandling(
      async () => {
        const BATCH_SIZE = 100;

        for (let i = 0; i < planIds.length; i += BATCH_SIZE) {
          const batchIds = planIds.slice(i, i + BATCH_SIZE);
          const readablePlans =
            await this.processReadablePlansForBatch(batchIds);

          // Mark plans without readable text as failed
          for (const planId of batchIds) {
            if (!readablePlans.find((p) => p.planId === planId)) {
              results.set(planId, null);
            }
          }

          if (readablePlans.length === 0) continue;

          const embeddings = await withErrorHandling(
            async () =>
              embeddingService.generateEmbeddings(
                readablePlans.map((p) => p.text)
              ),
            {
              fallback: [],
              errorMsg: `Failed to generate embeddings for batch starting at index ${i}`,
            }
          );

          if (embeddings.length === 0) {
            // Mark all as failed
            for (const { planId } of readablePlans) {
              results.set(planId, null);
            }
            continue;
          }

          // Update database with embeddings
          for (let j = 0; j < readablePlans.length; j++) {
            const { planId } = readablePlans[j];
            const embedding = embeddings[j];
            const success = await this.updatePlanEmbeddingInDb(
              planId,
              embedding
            );
            results.set(planId, success ? embedding : null);
          }

          logger.info(
            `Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(planIds.length / BATCH_SIZE)} (${readablePlans.length} embeddings)`
          );
        }

        return results;
      },
      { fallback: results, errorMsg: "Error in batch plan embedding update" }
    );
  }

  async updatePlanEmbedding(planId: string): Promise<number[] | null> {
    const results = await this.updatePlanEmbeddingsBatch([planId]);
    return results.get(planId) ?? null;
  }

  private async clearAllExistingPlanEmbeddings(): Promise<void> {
    await prisma.$executeRaw`
      UPDATE plans
      SET "embedding" = NULL
      WHERE "deletedAt" IS NULL
        AND ("finishingDate" IS NULL OR "finishingDate" > NOW())
    `;
    logger.info("Cleared all existing plan embeddings");
  }

  async forceResetPlanEmbeddings(): Promise<{
    total_plans: number;
    embeddings_created: number;
    failures: number;
  }> {
    logger.info("Starting force reset of plan embeddings");

    const allPlans = await prisma.plan.findMany({
      where: {
        deletedAt: null,
        OR: [{ finishingDate: null }, { finishingDate: { gt: new Date() } }],
      },
      select: { id: true },
    });

    const planIds = allPlans.map((p) => p.id);

    logger.info(`Found ${planIds.length} active plans to recreate embeddings`);

    await this.clearAllExistingPlanEmbeddings();

    const results = await this.updatePlanEmbeddingsBatch(planIds);

    const successCount = Array.from(results.values()).filter(
      (emb) => emb !== null
    ).length;
    const failureCount = planIds.length - successCount;

    const result = {
      total_plans: planIds.length,
      embeddings_created: successCount,
      failures: failureCount,
    };

    logger.info(
      `Force reset completed: ${successCount} embeddings created, ${failureCount} failures`
    );

    return result;
  }

  /**
   * Process post-activity coaching - sends celebration message after activity completion
   * This is called 30-90 seconds after user logs an activity
   */
  async processPostActivityCoaching(
    user: User,
    plan: Plan & { activities: Activity[] },
    activityEntry: ActivityEntry
  ): Promise<any | null> {
    try {
      logger.info(
        `Processing post-activity coaching for user '${user.username}' on plan '${plan.goal}'`
      );

      // Check if user is on free plan
      if (user.planType === "FREE") {
        logger.info(
          `Skipping user ${user.username} because they are on free plan`
        );
        return null;
      }

      // Import services dynamically to avoid circular dependency
      const { notificationService } = await import("./notificationService");
      const { aiService } = await import("./aiService");

      // Generate celebration message using AI
      const celebrationMessage = await aiService.generatePostActivityMessage(
        user,
        plan,
        {
          activityId: activityEntry.activityId,
          quantity: activityEntry.quantity,
          date: activityEntry.date,
        }
      );

      // Get or create coach for this user's plan
      let coach = await prisma.coach.findFirst({
        where: { ownerId: user.id },
      });

      if (!coach) {
        coach = await prisma.coach.create({
          data: {
            ownerId: user.id,
            details: {
              name: "Coach Oli",
              bio: "Your personal AI coach helping you achieve your goals",
            },
          },
        });
        logger.info(`Created new coach for user '${user.username}'`);
      }

      // Link coach to plan if not already linked
      if (plan.coachId !== coach.id) {
        await prisma.plan.update({
          where: { id: plan.id },
          data: { coachId: coach.id },
        });
      }

      // Get or create a chat for this user and coach
      let chat = await prisma.chat.findFirst({
        where: {
          userId: user.id,
          coachId: coach.id,
        },
      });

      if (!chat) {
        chat = await prisma.chat.create({
          data: {
            userId: user.id,
            coachId: coach.id,
            title: "General Coaching",
          },
        });
        logger.info(`Created new chat for user '${user.username}'`);
      }

      // Create message for conversation history
      await prisma.message.create({
        data: {
          chatId: chat.id,
          planId: plan.id,
          role: "COACH",
          content: `${celebrationMessage.title}\n\n${celebrationMessage.message}`,
        },
      });

      // Create and send notification
      const notification =
        await notificationService.createAndProcessNotification(
          {
            userId: user.id,
            title: celebrationMessage.title,
            message: celebrationMessage.message,
            type: "COACH",
            relatedId: plan.id,
            relatedData: {
              picture:
                "https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo_transparent.png",
              planId: plan.id,
              activityEntryId: activityEntry.id,
              celebrationType: "post_activity",
            },
          },
          true // pushNotify
        );

      logger.info(
        `Post-activity celebration notification sent to user '${user.username}' for plan '${plan.goal}'`
      );

      return notification;
    } catch (error) {
      logger.error(
        `Error processing post-activity coaching for user ${user.username}:`,
        error
      );
      // Don't throw - we don't want to fail the activity logging
      return null;
    }
  }

  /**
   * Process plan coaching for a user - recalculates plan state and sends notification if needed
   * This is called by the hourly job at the user's preferred coaching time
   */
  async processPlanCoaching(
    user: User & { plans: Plan[] },
    plan: Plan & { activities: Activity[] },
    pushNotify: boolean = true
  ): Promise<any | null> {
    try {
      logger.info(
        `Processing plan coaching for user '${user.username}' on plan '${plan.goal}'`
      );

      // Check if user has plans
      if (!user.plans || user.plans.length === 0) {
        logger.info(`User ${user.username} has no plans - skipping coaching`);
        return null;
      }

      // Check if user is on free plan
      if (user.planType === "FREE") {
        logger.info(
          `Skipping user ${user.username} because they are on free plan`
        );
        return null;
      }

      // Get activities from last 14 days to check if user is active
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const recentActivities = await prisma.activityEntry.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          date: {
            gte: fourteenDaysAgo,
          },
        },
      });

      if (recentActivities.length === 0) {
        logger.info(
          `No recent activities for user ${user.username} - skipping coaching`
        );
        return null;
      }

      // Store old state to check if it changed
      const oldState = plan.currentWeekState;

      // Recalculate plan state
      const updatedPlan = await this.recalculateCurrentWeekState(plan, user);

      // If state didn't change, no notification needed
      // if (updatedPlan.currentWeekState === oldState) {
      //   logger.info(
      //     `No state transition for plan '${plan.goal}' of user '${user.username}' - skipping notification`
      //   );
      //   return null;
      // }

      // // State changed - generate and send notification
      // logger.info(
      //   `Plan state changed from ${oldState} to ${updatedPlan.currentWeekState} for user '${user.username}'`
      // );

      // Import notificationService and aiService dynamically to avoid circular dependency
      const { notificationService } = await import("./notificationService");
      const { aiService } = await import("./aiService");

      // Generate coaching message using AI
      const coachMessage = await aiService.generateCoachMessage(
        user,
        updatedPlan
      );

      // Get or create coach for this user's plan
      let coach = await prisma.coach.findFirst({
        where: { ownerId: user.id },
      });

      if (!coach) {
        coach = await prisma.coach.create({
          data: {
            ownerId: user.id,
            details: {
              name: "Coach Oli",
              bio: "Your personal AI coach helping you achieve your goals",
            },
          },
        });
        logger.info(`Created new coach for user '${user.username}'`);
      }

      // Link coach to plan if not already linked
      if (updatedPlan.coachId !== coach.id) {
        await prisma.plan.update({
          where: { id: updatedPlan.id },
          data: { coachId: coach.id },
        });
      }

      // Get or create a chat for this user and coach
      let chat = await prisma.chat.findFirst({
        where: {
          userId: user.id,
          coachId: coach.id,
        },
      });

      if (!chat) {
        chat = await prisma.chat.create({
          data: {
            userId: user.id,
            coachId: coach.id,
            title: "General Coaching",
          },
        });
        logger.info(`Created new chat for user '${user.username}'`);
      }

      // Create message for conversation history
      await prisma.message.create({
        data: {
          chatId: chat.id,
          planId: plan.id,
          role: "COACH",
          content: `${coachMessage.title}\n\n${coachMessage.message}`,
        },
      });

      // Create and send notification
      const notification =
        await notificationService.createAndProcessNotification(
          {
            userId: user.id,
            title: coachMessage.title,
            message: coachMessage.message,
            type: "COACH",
            relatedId: plan.id,
            relatedData: {
              picture:
                "https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo_transparent.png",
              planId: plan.id,
              oldState,
              newState: updatedPlan.currentWeekState,
            },
          },
          pushNotify
        );

      logger.info(
        `Plan coaching notification and message sent to user '${user.username}' for plan '${plan.goal}'`
      );

      return notification;
    } catch (error) {
      logger.error(
        `Error processing plan coaching for user ${user.username}:`,
        error
      );
      // Don't throw - we don't want to stop the hourly job for one user's error
      return null;
    }
  }
}

export const plansService = new PlansService();
