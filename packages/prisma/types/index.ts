import {
  PlanOutlineType,
  PlanState,
  type Plan as PrismaPlan,
  type PlanMilestone as PrismaPlanMilestone,
} from "../generated/prisma";

export type MilestoneCriteria = {
  junction: "AND" | "OR";
  items: Array<{
    activityId: string;
    quantity: number;
  }>;
} | null;

export type PlanMilestone = Omit<PrismaPlanMilestone, "criteria"> & {
  criteria: MilestoneCriteria;
};

export type PlanAchievement = {
  streak: number;
  completedWeeks: number;
  /** Missed weeks in a row since the last completed one. */
  incompleteWeeks: number;
  totalWeeks: number;
  /** Set when last week was missed: what it cost, shown all this week. */
  missedLastWeek?: {
    streakBefore: number;
    streakAfter: number;
    inARow: number;
  } | null;
};

export type PlanProgressState = {
  achievement: PlanAchievement & {
    achievedLastStreakAt?: Date | null;
    celebratedStreakAt?: Date | null;
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
    achievedAt?: Date | null;
    celebratedAt?: Date | null;
  };
  lifestyleAchievement: {
    progressValue: number;
    maxValue: number;
    isAchieved: boolean;
    progressPercentage: number;
    achievedAt?: Date | null;
    celebratedAt?: Date | null;
  };
  weeks: Array<{
    startDate: Date;
    activities: any[];
    completedActivities: any[];
    plannedActivities: number | any[];
    weekActivities: any[];
    isCompleted: boolean;
  }>;
  currentWeekState: PlanState | undefined | null;
} | null;

export type PlanProgressData = {
  plan: {
    emoji: string;
    goal: string;
    id: string;
    type: PlanOutlineType;
  };
} & NonNullable<PlanProgressState>;

export type Plan = Omit<PrismaPlan, "milestones" | "progressState"> & {
  milestones: PlanMilestone[];
  progressState: PlanProgressState;
  embedding: number[] | null;
};
