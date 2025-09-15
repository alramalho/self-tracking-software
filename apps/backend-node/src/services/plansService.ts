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
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";
import { aiService } from "./aiService";

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

    console.log(
      `Calculating achievement for plan ${plan?.goal}. User ${user?.username}.`
    );
    console.log(`Activities: ${plan?.activities.map((a) => a.title)}`);

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
        console.log(
          `week ${weekStart} was completed. streak +1 = ${streak + 1}`
        );
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
        console.log(
          `week ${weekStart} was not completed. streak -1 = ${streak}`
        );
      }
    }

    console.log("streak", streak);

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
    userId: string
  ): Promise<
    {
      planId: string;
      plan: {
        emoji: string;
        goal: string;
        id: string;
        type: PlanOutlineType;
      };
      achievement: {
        streak: number;
        completedWeeks: number;
        incompleteWeeks: number;
        totalWeeks: number;
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
      weeks: Array<PlanWeek>;
    }[]
  > {
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

    // Execute all plan progress calculations in parallel
    const progressPromises = Promise.all(
      plans.map((plan) => this.getSinglePlanProgress(plan, user))
    );

    return await progressPromises;
  }

  private async getSinglePlanProgress(
    plan: Plan & { activities: Activity[] },
    user: User
  ): Promise<{
    planId: string;
    plan: {
      emoji: string;
      goal: string;
      id: string;
      type: PlanOutlineType;
    };
    achievement: {
      streak: number;
      completedWeeks: number;
      incompleteWeeks: number;
      totalWeeks: number;
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
    weeks: Array<PlanWeek>;
  }> {
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
      planId: plan.id,
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

    console.log({ completedActivities, numberOfDaysCompletedThisWeek });
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
      console.log({ startDate });
      actualStartDate = startDate;
    } else if (activityEntries.length > 0) {
      console.log("activityEntries[0].date", activityEntries[0].date);
      console.log(
        "toMidnightUTCDate(activityEntries[0].date)",
        toMidnightUTCDate(activityEntries[0].date)
      );
      actualStartDate = toMidnightUTCDate(activityEntries[0].date);
    } else {
      // If no activity entries exist, start from current week
      console.log("todaysLocalDate", todaysLocalDate());
      actualStartDate = todaysLocalDate();
    }

    console.log({ actualStartDate });

    const weeks: Array<PlanWeek> = [];

    let weekStart = toMidnightUTCDate(
      startOfWeek(actualStartDate, { weekStartsOn: 0 })
    );

    console.log({ planGoal: plan.goal });
    console.log({ weekStart });
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
}

export const plansService = new PlansService();
