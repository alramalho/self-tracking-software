import { TZDate } from "@date-fns/tz";
import {
  Plan,
  PlanOutlineType,
  PlanSession,
  PlanState,
  User,
  Activity,
  ActivityEntry,
} from "@tsw/prisma";
import {
  addWeeks,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isThisWeek,
  min,
  startOfWeek,
  subDays,
} from "date-fns";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { aiService } from "./aiService";
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
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      });

      return plans.length > 0 ? plans[0] : null;
    } catch (error) {
      logger.error("Error getting user's first plan:", error);
      throw error;
    }
  }

  // note to self: we were amidst fixing the recommendations
  private async getPlanWeekStats(
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
    const userCurrentDate = new TZDate(currentDate, timezone);

    // Get start of the week (Sunday) to match Python logic
    const weekStart = startOfWeek(userCurrentDate, { weekStartsOn: 0 }); // 0 = Sunday
    const weekEnd = endOfWeek(userCurrentDate, { weekStartsOn: 0 });

    const numLeftDaysInTheWeek = Math.max(
      0,
      Math.floor(
        (weekEnd.getTime() - userCurrentDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    );

    logger.debug(
      `User ${user.username} has ${numLeftDaysInTheWeek} left days in the week`
    );

    // Get activity entries for this week
    const activityEntries = await prisma.activityEntry.findMany({
      where: {
        activityId: { in: planWithActivities.activities.map((a: any) => a.id) },
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
        deletedAt: null,
      },
    });

    logger.debug(
      `User ${user.username} has logged ${activityEntries.length} activity entries this week`
    );

    // Count unique days with completions (max 1 per day to avoid double counting)
    const dailyCompletions = new Set();
    for (const entry of activityEntries) {
      const entryDate = new Date(entry.date);
      if (entryDate >= weekStart && entryDate <= weekEnd) {
        dailyCompletions.add(entryDate.toDateString());
      }
    }

    const daysCompletedThisWeek = dailyCompletions.size;

    logger.debug(
      `User ${user.username} has completed ${daysCompletedThisWeek} days this week`
    );

    // Calculate planned activities for this week
    let numActiveDaysInTheWeek: number;
    if (planWithActivities.outlineType === PlanOutlineType.TIMES_PER_WEEK) {
      numActiveDaysInTheWeek = planWithActivities.timesPerWeek || 0;
    } else {
      // Count sessions scheduled for this week
      const sessionsThisWeek = await prisma.planSession.findMany({
        where: {
          planId: planWithActivities.id,
          date: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      });
      // create a set of dates where there's a session scheduled
      const activeDaysInTheWeek = new Set();
      for (const session of sessionsThisWeek) {
        activeDaysInTheWeek.add(session.date);
      }
      numActiveDaysInTheWeek = activeDaysInTheWeek.size;
    }

    logger.debug(
      `Plan ${planWithActivities.goal} (${planWithActivities.outlineType}) has ${numActiveDaysInTheWeek} planned active days this week`
    );

    const numActiveDaysLeftInTheWeek = Math.max(
      0,
      numActiveDaysInTheWeek - daysCompletedThisWeek
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

  async recalculateCurrentWeekState(plan: Plan, user: User): Promise<Plan> {
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
        this.processStateTransition(updatedPlan, user, newState).catch(
          (error) => {
            logger.error(
              `Error processing state transition for plan ${updatedPlan.id}:`,
              error
            );
          }
        );

        logger.info(
          `Plan '${plan.goal}' of user '${user.username}' state transition: ${oldState} -> ${newState}`
        );
      }

      logger.info(
        `Updated plan '${plan.goal}' of user '${user.username}' current week state from ${oldState} to ${newState}`
      );
      return updatedPlan;
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
      let coachNotesData: {
        goal: string;
        outlineType: PlanOutlineType;
        timesPerWeek?: number;
        oldSessions?: PlanSession[];
        newSessions?: PlanSession[];
      } = {
        goal: plan.goal,
        outlineType: plan.outlineType,
      };

      if (
        newState === PlanState.FAILED &&
        (plan.suggestedByCoachAt ? !isThisWeek(plan.suggestedByCoachAt) : true)
      ) {
        if (plan.outlineType === PlanOutlineType.TIMES_PER_WEEK) {
          // Reduce times per week by 1 (minimum 1)
          const newTimesPerWeek = Math.max(1, (plan.timesPerWeek || 1) - 1);
          updatePlanData.coachSuggestedTimesPerWeek = newTimesPerWeek;
          updatePlanData.suggestedByCoachAt = new Date();
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
          coachNotesData.oldSessions = plan.sessions as PlanSession[];
          const actualNewSesssions =
            await prisma.planSession.createManyAndReturn({
              data: suggestedSessions.sessions.map((session) => ({
                planId: plan.id,
                date: session.date,
                activityId: session.activityId,
                quantity: session.quantity,
                isCoachSuggested: true,
              })),
            });
          coachNotesData.newSessions = actualNewSesssions;
          updatePlanData.suggestedByCoachAt = new Date();
        }
      }

      const coachNotes = await aiService.generateCoachNotes(
        coachNotesData,
        newState,
        planWithActivities.activities
      );
      updatePlanData.coachNotes = coachNotes;

      await prisma.plan.update({
        where: { id: plan.id },
        data: updatePlanData,
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

  private isWeekCompleted(
    weekStartDate: Date,
    plan: Plan & { activities: Activity[]; sessions: PlanSession[] },
    planActivityEntries: ActivityEntry[]
  ): boolean {
    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 0 });
    const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 0 });

    if (plan.outlineType === PlanOutlineType.TIMES_PER_WEEK) {
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
            entry.activityId === session.activityId &&
            isAfter(new Date(entry.date), weekStart) &&
            isBefore(new Date(entry.date), weekEnd)
        );

        return completedSessionsThisWeek.length > 0;
      });

      return allSessionsCompleted;
    }
  }

  async calculatePlanAchievement(
    planId: string,
    initialDate?: Date
  ): Promise<{
    streak: number;
    completedWeeks: number;
    incompleteWeeks: number;
    isAchieved: boolean;
    totalWeeks: number;
    weeksToAchieve?: number;
  }> {
    // Get plan with activities and sessions
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        activities: true,
        sessions: true,
      },
    });

    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    // Get activity entries for this plan's activities
    const activityEntries = await prisma.activityEntry.findMany({
      where: {
        activityId: { in: plan.activities.map((a) => a.id) },
        deletedAt: null,
      },
    });

    const planActivityEntries = activityEntries.filter(
      (entry) => plan.activities.some((a) => a.id === entry.activityId)
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
      const wasCompleted = this.isWeekCompleted(weekStart, plan, planActivityEntries);

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

    const isAchieved = streak >= this.LIFESTYLE_WEEKS;
    const weeksToAchieve = this.LIFESTYLE_WEEKS - streak;

    return {
      streak,
      completedWeeks,
      incompleteWeeks,
      isAchieved,
      totalWeeks,
      weeksToAchieve,
    };
  }

  private calculateHabitAchievement(achievement: {
    streak: number;
    completedWeeks: number;
    incompleteWeeks: number;
    isAchieved: boolean;
    totalWeeks: number;
    weeksToAchieve?: number;
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
    isAchieved: boolean;
    totalWeeks: number;
    weeksToAchieve?: number;
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

  async getPlanProgress(planId: string, userId: string): Promise<{
    planId: string;
    achievement: {
      streak: number;
      completedWeeks: number;
      incompleteWeeks: number;
      isAchieved: boolean;
      totalWeeks: number;
      weeksToAchieve?: number;
    };
    currentWeekStats: {
      numActiveDaysInTheWeek: number;
      numLeftDaysInTheWeek: number;
      numActiveDaysLeftInTheWeek: number;
      daysCompletedThisWeek: number;
    };
    habitAchievement: {
      progressValue: number;
      maxValue: number;
      isAchieved: boolean;
      progressPercentage: number;
    };
    lifestyleAchievement: {
      progressValue: number;
      maxValue: number;
      isAchieved: boolean;
      progressPercentage: number;
    };
  }> {
    // Verify plan ownership
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { activities: true },
    });

    if (!plan || plan.userId !== userId) {
      throw new Error(`Plan ${planId} not found or not owned by user ${userId}`);
    }

    // Get user for timezone info
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Get achievement data
    const achievement = await this.calculatePlanAchievement(planId);

    // Get current week stats
    const currentWeekStats = await this.getPlanWeekStats(plan, user);

    // Calculate habit and lifestyle achievements
    const habitAchievement = this.calculateHabitAchievement(achievement);
    const lifestyleAchievement = this.calculateLifestyleAchievement(achievement);

    return {
      planId,
      achievement,
      currentWeekStats,
      habitAchievement,
      lifestyleAchievement,
    };
  }
}

export const plansService = new PlansService();
